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
	} {
		const affectedClients = new Set<number>();
		const missingClients: Record<number, number> = {};

		// pendingStructs is guaranteed to be non-null here since we check in logExistingPendingStructs
		// Extract client IDs from missing Map<clientId, clock>
		pendingStructs.missing.forEach((clock, clientId) => { // TODO: Möglicherweise auch clientId, clock ...ka die Reihenfolge.
			affectedClients.add(Number(clientId));
			missingClients[Number(clientId)] = Number(clock);
		});

		return {
			missingStructs: pendingStructs.missing,
			updateStructs: pendingStructs.update,
			affectedClients,
			missingClients,
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
}
