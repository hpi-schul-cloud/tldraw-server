import { Injectable, OnModuleInit } from '@nestjs/common';
import { array, decoding, promise } from 'lib0';
import { applyAwarenessUpdate, Awareness } from 'y-protocols/awareness';
import { applyUpdate, applyUpdateV2, Doc, encodeStateVector } from 'yjs';
import { Logger } from '../logger/logger.js';
import { MetricsService } from '../metrics/metrics.service.js';
import { RedisAdapter, StreamMessageReply, StreamNameClockPair } from '../redis/interfaces/index.js';
import { computeRedisRoomStreamName, extractMessagesFromStreamReply } from './helper.js';
import { YRedisMessage } from './interfaces/stream-message.js';
import * as protocol from './protocol.js';
import { DocumentStorage } from './storage.js';
import { YRedisDocFactory } from './y-redis-doc.factory.js';
import { YRedisDoc } from './y-redis-doc.js';

@Injectable()
export class YRedisClient implements OnModuleInit {
	public readonly redisPrefix: string;

	public constructor(
		private readonly storage: DocumentStorage,
		public readonly redis: RedisAdapter,
		private readonly logger: Logger,
	) {
		this.logger.setContext(YRedisClient.name);
		this.redisPrefix = redis.redisPrefix;
	}

	public async onModuleInit(): Promise<void> {
		await this.redis.createGroup();
	}

	public async getMessages(streams: StreamNameClockPair[]): Promise<YRedisMessage[]> {
		const streamReplyRes = await this.redis.readStreams(streams);

		const res: YRedisMessage[] = [];

		streamReplyRes?.forEach((stream) => {
			const messages = this.extractMessages(stream.messages);
			res.push({
				stream: stream.name.toString(),
				messages: protocol.mergeMessages(messages),
				lastId: stream.messages ? array.last(stream.messages).id.toString() : '',
			});
		});

		return res;
	}

	public addMessage(room: string, docid: string, m: Buffer): Promise<unknown> {
		// handle sync step 2 like a normal update message
		if (m[0] === protocol.messageSync && m[1] === protocol.messageSyncStep2) {
			if (m.byteLength < 4) {
				// message does not contain any content, don't distribute
				return promise.resolve();
			}
			m[1] = protocol.messageSyncUpdate;
		}

		return this.redis.addMessage(computeRedisRoomStreamName(room, docid, this.redisPrefix), m);
	}

	public getStateVector(room: string, docid = '/'): Promise<Uint8Array | null> {
		return this.storage.retrieveStateVector(room, docid);
	}

	public async getDoc(room: string, docid: string): Promise<YRedisDoc> {
		const end = MetricsService.methodDurationHistogram.startTimer();
		let docChanged = false;

		const streamName = computeRedisRoomStreamName(room, docid, this.redisPrefix);
		const streamReply = await this.redis.readMessagesFromStream(streamName);

		const ms = extractMessagesFromStreamReply(streamReply, this.redisPrefix);

		const docMessages = ms.get(room)?.get(docid) ?? null;
		const docstate = await this.storage.retrieveDoc(room, docid);

		const ydoc = new Doc();
		const awareness = new Awareness(ydoc);
		awareness.setLocalState(null); // we don't want to propagate awareness state

		if (docstate) {
			applyUpdateV2(ydoc, docstate.doc);
		}

		ydoc.once('afterTransaction', (tr) => {
			docChanged = tr.changed.size > 0;
		});

		ydoc.transact(() => {
			this.handleMessageUpdates(docMessages, ydoc, awareness);
		});

		// Versuche automatische Reparatur von pendingStructs
		if (ydoc.store.pendingStructs !== null) {
			const repaired = this.attemptQuickRepair(ydoc);
			if (!repaired) {
				this.logger.info(`Document ${room}/${docid} still has pending structures after quick repair attempt`);
			}
		}

		this.logExistingPendingStructs(room, docid, ydoc);

		end();

		const response = YRedisDocFactory.build({
			ydoc,
			awareness,
			redisLastId: docMessages?.lastId.toString() ?? '0',
			storeReferences: docstate?.references ?? null,
			docChanged,
			streamName,
		});

		return response;
	}

	private logExistingPendingStructs(room: string, docid: string, ydoc: Doc): void {
		if (ydoc.store.pendingStructs !== null) {
			const stateVector = Array.from(encodeStateVector(ydoc));
			const pendingAnalysis = this.analyzePendingStructs(ydoc.store.pendingStructs);

			this.logger.warning(
				`Document ${room}/${docid} has pending structures. Details: ${JSON.stringify({
					stateVector,
					...pendingAnalysis,
				})}`,
			);
		}
	}

	private analyzePendingStructs(pendingStructs: { missing: Map<number, number>; update: Uint8Array }): {
		missingStructs: Map<number, number>;
		updateStructs: Uint8Array;
		affectedClients: Set<number>;
		missingClients: Record<number, number>;
		missingCount: number;
		updateSize: number;
	} {
		const affectedClients = new Set<number>();
		const missingClients: Record<number, number> = {};

		// Extract client IDs from missing Map<clientId, clock>
		pendingStructs.missing.forEach((clock, clientId) => {
			// Basierend auf Yjs source: Map<clientId, clock> - clientId ist der Key, clock der Value
			affectedClients.add(Number(clientId));
			missingClients[Number(clientId)] = Number(clock);
		});

		return {
			missingStructs: pendingStructs.missing,
			updateStructs: pendingStructs.update,
			affectedClients,
			missingClients,
			missingCount: pendingStructs.missing.size,
			updateSize: pendingStructs.update.length,
		};
	}

	public async destroy(): Promise<void> {
		await this.redis.quit();
	}

	private handleMessageUpdates(docMessages: YRedisMessage | null, ydoc: Doc, awareness: Awareness): void {
		docMessages?.messages.forEach((m) => {
			const decoder = decoding.createDecoder(m);
			const messageType = decoding.readVarUint(decoder);
			switch (messageType) {
				case protocol.messageSync: {
					// The methode readVarUnit works with a pointer, that increases by each execution. The second execution gets the second value.
					const syncType = decoding.readVarUint(decoder);
					if (syncType === protocol.messageSyncUpdate) {
						applyUpdate(ydoc, decoding.readVarUint8Array(decoder));
					}
					break;
				}
				case protocol.messageAwareness: {
					applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), null);
					break;
				}
			}
		});
	}

	private extractMessages(messages: StreamMessageReply[] | null): Buffer[] {
		if (messages === null) {
			return [];
		}

		const filteredMessages: Buffer[] = [];

		messages.forEach((message) => {
			if ('m' in message.message && Buffer.isBuffer(message.message.m) && message.message.m) {
				filteredMessages.push(message.message.m);
			}
		});

		return filteredMessages;
	}

	/**
	 * Versucht pendingStructs zu reparieren, wenn Updates verloren gegangen sind.
	 * Basierend auf Yjs-Mechanismen für State-Vector-Synchronisation.
	 */
	public async repairPendingStructs(
		room: string,
		docid: string,
		ydoc: Doc,
	): Promise<{
		success: boolean;
		method: string;
		recoveredUpdates?: number;
		remainingPending?: number;
		message: string;
	}> {
		if (ydoc.store.pendingStructs === null) {
			return {
				success: true,
				method: 'none_needed',
				message: 'No pending structures found - document is in sync',
			};
		}

		const initialAnalysis = this.analyzePendingStructs(ydoc.store.pendingStructs);
		this.logger.info(
			`Attempting to repair pending structures for ${room}/${docid}. Missing: ${initialAnalysis.missingCount}, Update size: ${initialAnalysis.updateSize}`,
		);

		// Strategie 1: State Vector Synchronisation
		const stateVectorResult = await this.tryStateVectorRepair(room, docid, ydoc);
		if (stateVectorResult.success) {
			return stateVectorResult;
		}

		// Strategie 2: Pending Update direkt anwenden
		const pendingUpdateResult = this.tryApplyPendingUpdate(ydoc);
		if (pendingUpdateResult.success) {
			return pendingUpdateResult;
		}

		// Strategie 3: Vollständige Dokumenten-Resynchronisation
		const fullSyncResult = await this.tryFullDocumentSync(room, docid, ydoc);
		if (fullSyncResult.success) {
			return fullSyncResult;
		}

		return {
			success: false,
			method: 'all_failed',
			remainingPending: ydoc.store.pendingStructs
				? this.analyzePendingStructs(ydoc.store.pendingStructs).missingCount
				: 0,
			message: 'All repair strategies failed - manual intervention may be required',
		};
	}

	/**
	 * Strategie 1: Versucht Reparatur durch State Vector Synchronisation
	 */
	private async tryStateVectorRepair(
		room: string,
		docid: string,
		ydoc: Doc,
	): Promise<{ success: boolean; method: string; recoveredUpdates?: number; message: string }> {
		try {
			// Aktuellen State Vector des Dokuments abrufen
			const currentStateVector = encodeStateVector(ydoc);

			// Gespeicherten State Vector aus Storage abrufen
			const storedStateVector = await this.getStateVector(room, docid);

			if (!storedStateVector) {
				return {
					success: false,
					method: 'state_vector',
					message: 'No stored state vector available for comparison',
				};
			}

			// Prüfen ob State Vectors unterschiedlich sind
			if (this.compareStateVectors(currentStateVector, storedStateVector)) {
				return {
					success: false,
					method: 'state_vector',
					message: 'State vectors are identical - no missing updates detectable',
				};
			}

			// Re-read von Redis für fehlende Updates
			const streamName = computeRedisRoomStreamName(room, docid, this.redisPrefix);
			const streamReply = await this.redis.readMessagesFromStream(streamName);
			const ms = extractMessagesFromStreamReply(streamReply, this.redisPrefix);
			const docMessages = ms.get(room)?.get(docid) ?? null;

			const beforePendingCount = ydoc.store.pendingStructs
				? this.analyzePendingStructs(ydoc.store.pendingStructs).missingCount
				: 0;

			// Erneute Anwendung aller Messages
			ydoc.transact(() => {
				this.handleMessageUpdates(docMessages, ydoc, new Awareness(ydoc));
			});

			const afterPendingCount = ydoc.store.pendingStructs
				? this.analyzePendingStructs(ydoc.store.pendingStructs).missingCount
				: 0;
			const recovered = beforePendingCount - afterPendingCount;

			if (afterPendingCount === 0) {
				return {
					success: true,
					method: 'state_vector',
					recoveredUpdates: recovered,
					message: `Successfully repaired ${recovered} pending structures through re-sync`,
				};
			}

			return {
				success: false,
				method: 'state_vector',
				message: `Partial repair: recovered ${recovered} structures, ${afterPendingCount} still pending`,
			};
		} catch (error) {
			return {
				success: false,
				method: 'state_vector',
				message: `State vector repair failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			};
		}
	}

	/**
	 * Strategie 2: Versucht die pending Update direkt anzuwenden
	 */
	private tryApplyPendingUpdate(ydoc: Doc): {
		success: boolean;
		method: string;
		recoveredUpdates?: number;
		message: string;
	} {
		if (!ydoc.store.pendingStructs || ydoc.store.pendingStructs.update.length === 0) {
			return {
				success: false,
				method: 'pending_update',
				message: 'No pending update data available to apply',
			};
		}

		try {
			const beforeCount = this.analyzePendingStructs(ydoc.store.pendingStructs).missingCount;

			// Versuche das pending Update direkt anzuwenden
			// Dies kann helfen wenn das Update nur "steckt" aber die Daten korrekt sind
			ydoc.transact(() => {
				try {
					if (ydoc.store.pendingStructs) {
						applyUpdate(ydoc, ydoc.store.pendingStructs.update);
					}
				} catch {
					// Fallback: Update als V2 versuchen
					if (ydoc.store.pendingStructs) {
						applyUpdateV2(ydoc, ydoc.store.pendingStructs.update);
					}
				}
			});

			const afterCount = ydoc.store.pendingStructs
				? this.analyzePendingStructs(ydoc.store.pendingStructs).missingCount
				: 0;
			const recovered = beforeCount - afterCount;

			if (afterCount === 0) {
				return {
					success: true,
					method: 'pending_update',
					recoveredUpdates: recovered,
					message: `Successfully applied pending update, recovered ${recovered} structures`,
				};
			}

			return {
				success: false,
				method: 'pending_update',
				message: `Partial success: applied update but ${afterCount} structures still pending`,
			};
		} catch (error) {
			return {
				success: false,
				method: 'pending_update',
				message: `Failed to apply pending update: ${error instanceof Error ? error.message : 'Unknown error'}`,
			};
		}
	}

	/**
	 * Strategie 3: Vollständige Dokumenten-Resynchronisation
	 */
	private async tryFullDocumentSync(
		room: string,
		docid: string,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		ydoc: Doc,
	): Promise<{ success: boolean; method: string; recoveredUpdates?: number; message: string }> {
		try {
			// Gespeicherten Dokumentzustand aus Storage laden
			const docstate = await this.storage.retrieveDoc(room, docid);
			if (!docstate) {
				return {
					success: false,
					method: 'full_sync',
					message: 'No stored document state available for full sync',
				};
			}

			// Wir verfolgen die Anzahl nicht in dieser Strategie, da wir das Dokument neu erstellen

			// Neues Dokument erstellen und gespeicherten Zustand anwenden
			const freshDoc = new Doc();
			applyUpdateV2(freshDoc, docstate.doc);

			// Dann alle Redis-Messages erneut anwenden
			const streamName = computeRedisRoomStreamName(room, docid, this.redisPrefix);
			const streamReply = await this.redis.readMessagesFromStream(streamName);
			const ms = extractMessagesFromStreamReply(streamReply, this.redisPrefix);
			const docMessages = ms.get(room)?.get(docid) ?? null;

			freshDoc.transact(() => {
				this.handleMessageUpdates(docMessages, freshDoc, new Awareness(freshDoc));
			});

			// Prüfen ob das frische Dokument sauber ist
			if (freshDoc.store.pendingStructs === null) {
				// Das originale Dokument durch das frische ersetzen ist nicht direkt möglich
				// Aber wir können den Zustand übertragen
				return {
					success: false, // Technisch nicht direkt erfolgreich, da wir das Doc nicht ersetzen können
					method: 'full_sync',
					message:
						'Fresh document is clean, but cannot replace original doc instance. Consider recreating the document.',
				};
			}

			return {
				success: false,
				method: 'full_sync',
				message: 'Full sync created document also has pending structures - data corruption likely',
			};
		} catch (error) {
			return {
				success: false,
				method: 'full_sync',
				message: `Full document sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			};
		}
	}

	/**
	 * Hilfsmethode zum Vergleichen von State Vectors
	 */
	private compareStateVectors(vector1: Uint8Array, vector2: Uint8Array): boolean {
		if (vector1.length !== vector2.length) {
			return false;
		}
		for (let i = 0; i < vector1.length; i++) {
			if (vector1[i] !== vector2[i]) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Einfache automatische Reparatur von pendingStructs
	 * Kann direkt nach dem Laden eines Dokuments aufgerufen werden
	 */
	public attemptQuickRepair(ydoc: Doc): boolean {
		if (ydoc.store.pendingStructs === null) {
			return true; // Bereits sauber
		}

		const originalCount = this.analyzePendingStructs(ydoc.store.pendingStructs).missingCount;

		// Strategie: Erneute Transaktionsausführung, um "steckende" Updates zu lösen
		try {
			ydoc.transact(() => {
				// Manchmal hilft es, einfach eine leere Transaktion auszuführen
				// Dies kann Yjs dazu bringen, pendingStructs zu verarbeiten
			});

			// Prüfen ob die Reparatur erfolgreich war
			const newCount = ydoc.store.pendingStructs
				? this.analyzePendingStructs(ydoc.store.pendingStructs).missingCount
				: 0;

			if (newCount < originalCount) {
				this.logger.info(`Quick repair reduced pending structures from ${originalCount} to ${newCount}`);

				return newCount === 0;
			}
		} catch (error) {
			this.logger.debug(`Quick repair failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}

		return false;
	}
}
