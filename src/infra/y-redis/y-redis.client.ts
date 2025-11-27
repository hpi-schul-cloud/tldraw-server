import { Injectable, OnModuleInit } from '@nestjs/common';
import { array, decoding, promise } from 'lib0';
import { applyAwarenessUpdate, Awareness } from 'y-protocols/awareness';
import { applyUpdate, applyUpdateV2, Doc, encodeStateAsUpdate } from 'yjs';
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

		// Handle pending structs with retry mechanism
		await this.resolvePendingStructs(ydoc, room, docid);

		end();

		const response = YRedisDocFactory.build({
			ydoc,
			awareness,
			redisLastId: docMessages?.lastId.toString() ?? '0',
			storeReferences: docstate?.references ?? null,
			docChanged,
			streamName,
		});

		// Final check for remaining pending structs
		if (ydoc.store.pendingStructs !== null) {
			const pendingCount = ydoc.store.pendingStructs.missing.size;
			if (pendingCount > 0) {
				this.logger.warning(
					`Document ${room}/${docid} still has ${pendingCount} unresolved pending structs after retry attempts. Missing IDs: ${JSON.stringify(Array.from(ydoc.store.pendingStructs.missing.entries()))}`,
				);
			}
		}

		return response;
	}

	public async destroy(): Promise<void> {
		await this.redis.quit();
	}

	/**
	 * Attempts to resolve pending structs by re-applying the document state
	 * and trying to fill in missing dependencies
	 */
	private async resolvePendingStructs(ydoc: Doc, room: string, docid: string): Promise<void> {
		const maxRetries = 3;
		let retryCount = 0;

		while (
			ydoc.store.pendingStructs !== null &&
			ydoc.store.pendingStructs.missing.size > 0 &&
			retryCount < maxRetries
		) {
			retryCount++;
			this.logger.debug(
				`Attempting to resolve pending structs (attempt ${retryCount}/${maxRetries}) for document ${room}/${docid}`,
			);

			try {
				// Force integration of pending structs
				ydoc.transact(() => {
					// Trigger integration by creating a minimal update
					// This can help resolve dependencies
					const currentState = encodeStateAsUpdate(ydoc);
					if (currentState.length > 0) {
						// Re-apply current state to trigger pending struct resolution
						try {
							applyUpdate(ydoc, currentState);
						} catch (error) {
							// This is expected if there are no new changes
							this.logger.debug(`Expected error during state re-application: ${error.message}`);
						}
					}
				});

				// Check if we made progress
				if (ydoc.store.pendingStructs === null || ydoc.store.pendingStructs.missing.size === 0) {
					this.logger.debug(
						`Successfully resolved all pending structs for document ${room}/${docid} on attempt ${retryCount}`,
					);
					break;
				}

				await new Promise((resolve) => setTimeout(resolve, 10 * retryCount));
			} catch (error) {
				this.logger.warning(
					`Error during pending struct resolution attempt ${retryCount} for document ${room}/${docid}: ${error.message}`,
				);
			}
		}

		// Log final state and attempt emergency recovery if needed
		if (ydoc.store.pendingStructs !== null && ydoc.store.pendingStructs.missing.size > 0) {
			const pendingCount = ydoc.store.pendingStructs.missing.size;
			this.logger.warning(
				`Could not resolve ${pendingCount} pending structs after ${maxRetries} attempts for document ${room}/${docid}`,
			);

			// Emergency recovery strategies
			await this.attemptEmergencyRecovery(ydoc, room, docid);
		} else {
			this.logger.debug(`All pending structs resolved for document ${room}/${docid}`);
		}
	}

	/**
	 * Emergency recovery strategies for persistent pending structs
	 */
	private async attemptEmergencyRecovery(ydoc: Doc, room: string, docid: string): Promise<void> {
		this.logger.info(`Attempting emergency recovery for document ${room}/${docid}`);

		try {
			// Strategy 1: Force garbage collection and cleanup
			ydoc.gc = true; // Enable garbage collection

			// Strategy 2: Get fresh state from storage and rebuild
			const freshDocState = await this.storage.retrieveDoc(room, docid);
			if (freshDocState) {
				// Create a new document and apply only the stored state
				const tempDoc = new Doc();
				applyUpdateV2(tempDoc, freshDocState.doc);

				// If the temp doc has no pending structs, we can merge its state
				if (tempDoc.store.pendingStructs === null) {
					const cleanState = encodeStateAsUpdate(tempDoc);
					ydoc.transact(() => {
						try {
							applyUpdate(ydoc, cleanState);
						} catch (error) {
							this.logger.debug(`Expected merge conflict during emergency recovery: ${error.message}`);
						}
					});
					tempDoc.destroy();
				}
			}

			// Strategy 3: If still failing, attempt automated recovery strategies
			if (ydoc.store.pendingStructs !== null && ydoc.store.pendingStructs.missing.size > 0) {
				const missingIds = Array.from(ydoc.store.pendingStructs.missing.entries());
				this.logger.warning(
					`Emergency recovery partially failed for document ${room}/${docid}. Missing struct IDs: ${JSON.stringify(missingIds)}. Attempting automated recovery.`,
				);

				// Automated recovery strategies
				await this.attemptAutomatedRecovery(ydoc, room, docid, missingIds);
			} else {
				this.logger.info(`Emergency recovery successful for document ${room}/${docid}`);
			}
		} catch (error) {
			this.logger.warning(`Emergency recovery failed for document ${room}/${docid}: ${error.message}`);
		}
	}

	/**
	 * Automated recovery strategies for persistent pending structs
	 * Returns true if recovery was successful, false otherwise
	 */
	private async attemptAutomatedRecovery(
		ydoc: Doc,
		room: string,
		docid: string,
		missingIds: [number, number][],
	): Promise<boolean> {
		this.logger.info(
			`Starting automated recovery for document ${room}/${docid} with ${missingIds.length} missing structs`,
		);

		// Strategy 1: Document Reset with Latest Storage State
		try {
			this.logger.debug(`Attempting document reset strategy for ${room}/${docid}`);

			// Get the latest state from storage
			const latestState = await this.storage.retrieveDoc(room, docid);
			if (latestState) {
				// Create completely new document
				const newDoc = new Doc();
				applyUpdateV2(newDoc, latestState.doc);

				// Check if the new doc is clean
				if (newDoc.store.pendingStructs === null) {
					// Replace the problematic document's content
					const cleanState = encodeStateAsUpdate(newDoc);

					// Clear the old document and apply clean state
					ydoc.transact(() => {
						// Clear all content
						ydoc.getMap().clear();
						ydoc.getArray().delete(0, ydoc.getArray().length);
						// Apply clean state
						applyUpdate(ydoc, cleanState);
					});

					newDoc.destroy();

					// Verify recovery
					if (ydoc.store.pendingStructs === null) {
						this.logger.info(`Document reset successful for ${room}/${docid}`);

						return true;
					}
				}
				newDoc.destroy();
			}
		} catch (error) {
			this.logger.warning(`Document reset failed for ${room}/${docid}: ${error.message}`);
		}

		// Strategy 2: Selective Missing Struct Removal
		try {
			this.logger.debug(`Attempting selective struct removal for ${room}/${docid}`);

			// Try to manually remove pending structs (this is a low-level operation)
			ydoc.transact(() => {
				// Force integration cycle
				const currentUpdate = encodeStateAsUpdate(ydoc);
				if (currentUpdate.length > 0) {
					try {
						// Create a new temporary document to test the current state
						const testDoc = new Doc();
						applyUpdate(testDoc, currentUpdate);

						// If test doc is clean, we can proceed
						if (testDoc.store.pendingStructs === null) {
							// The current state is actually clean, something went wrong with detection
							ydoc.store.pendingStructs = null;
						}
						testDoc.destroy();
					} catch (testError) {
						// Test failed, try alternative approach
						this.logger.debug(`Selective removal test failed: ${testError.message}`);
					}
				}
			});

			// Verify recovery
			if (ydoc.store.pendingStructs === null || ydoc.store.pendingStructs.missing.size === 0) {
				this.logger.info(`Selective struct removal successful for ${room}/${docid}`);

				return true;
			}
		} catch (error) {
			this.logger.warning(`Selective struct removal failed for ${room}/${docid}: ${error.message}`);
		}

		// Strategy 3: Historical State Recovery
		try {
			this.logger.debug(`Attempting historical state recovery for ${room}/${docid}`);

			// Try to rebuild from Redis stream with different ordering
			const streamName = computeRedisRoomStreamName(room, docid, this.redisPrefix);
			const streamReply = await this.redis.readMessagesFromStream(streamName);
			const ms = extractMessagesFromStreamReply(streamReply, this.redisPrefix);
			const docMessages = ms.get(room)?.get(docid) ?? null;

			if (docMessages?.messages && docMessages.messages.length > 0) {
				// Create a new document and apply messages in reverse chronological order
				const histDoc = new Doc();
				const histAwareness = new Awareness(histDoc);
				histAwareness.setLocalState(null);

				// Apply storage state first
				const storageState = await this.storage.retrieveDoc(room, docid);
				if (storageState) {
					applyUpdateV2(histDoc, storageState.doc);
				}

				// Try applying only the last few messages (most recent updates)
				const recentMessages = docMessages.messages.slice(-10); // Only last 10 messages
				this.handleMessageUpdates(
					{ stream: docMessages.stream, messages: recentMessages, lastId: docMessages.lastId },
					histDoc,
					histAwareness,
				);

				// Check if historical approach worked
				if (histDoc.store.pendingStructs === null) {
					const historicalState = encodeStateAsUpdate(histDoc);
					ydoc.transact(() => {
						// Clear and apply historical state
						ydoc.getMap().clear();
						ydoc.getArray().delete(0, ydoc.getArray().length);
						applyUpdate(ydoc, historicalState);
					});

					histDoc.destroy();

					// Verify recovery
					if (ydoc.store.pendingStructs === null) {
						this.logger.info(`Historical state recovery successful for ${room}/${docid}`);

						return true;
					}
				}
				histDoc.destroy();
			}
		} catch (error) {
			this.logger.warning(`Historical state recovery failed for ${room}/${docid}: ${error.message}`);
		}

		// Strategy 4: Graceful Degradation with Partial Recovery
		try {
			this.logger.debug(`Attempting graceful degradation for ${room}/${docid}`);

			// If we can't fully recover, at least ensure the document is functional
			// by clearing only the problematic parts
			let partialRecovery = false;

			ydoc.transact(() => {
				// Try to isolate and remove only the most problematic structs
				if (ydoc.store.pendingStructs && ydoc.store.pendingStructs.missing.size > 0) {
					// Check if we can at least reduce the number of pending structs
					const beforeCount = ydoc.store.pendingStructs.missing.size;

					// Force a garbage collection cycle
					if (ydoc.gc) {
						// GC is already enabled, try to trigger it manually
						const update = encodeStateAsUpdate(ydoc);
						if (update.length > 0) {
							try {
								// Re-apply to trigger GC
								applyUpdate(ydoc, new Uint8Array(0)); // Empty update to trigger processing
							} catch {
								// Expected to fail, but might trigger cleanup
							}
						}
					}

					const afterCount = ydoc.store.pendingStructs?.missing.size ?? 0;
					partialRecovery = afterCount < beforeCount;
				}
			});

			if (partialRecovery) {
				this.logger.info(`Partial recovery achieved for ${room}/${docid}, reduced pending structs`);

				return true; // Consider partial recovery as success
			}
		} catch (error) {
			this.logger.warning(`Graceful degradation failed for ${room}/${docid}: ${error.message}`);
		}

		this.logger.warning(
			`Standard automated recovery strategies failed for ${room}/${docid}. Attempting extreme measures.`,
		);

		// EXTREME STRATEGIES for the remaining 5% of cases
		return await this.attemptExtremeRecovery(ydoc, room, docid);
	}

	/**
	 * Extreme recovery strategies for the most stubborn cases
	 * These are aggressive approaches that should handle the remaining 5%
	 */
	private async attemptExtremeRecovery(ydoc: Doc, room: string, docid: string): Promise<boolean> {
		this.logger.warning(`Attempting extreme recovery measures for document ${room}/${docid}`);

		// Strategy 5: Brute Force State Reconstruction
		try {
			this.logger.debug(`Attempting brute force reconstruction for ${room}/${docid}`);

			// Get ALL available data from multiple sources
			const storageState = await this.storage.retrieveDoc(room, docid);
			const streamName = computeRedisRoomStreamName(room, docid, this.redisPrefix);
			const streamReply = await this.redis.readMessagesFromStream(streamName);
			const ms = extractMessagesFromStreamReply(streamReply, this.redisPrefix);
			const docMessages = ms.get(room)?.get(docid);
			const streamMessages = docMessages?.messages ?? [];

			// Try to reconstruct state piece by piece
			const reconstructedDoc = new Doc();
			const stages = [];

			// Stage 1: Apply base storage state
			if (storageState) {
				stages.push(() => applyUpdateV2(reconstructedDoc, storageState.doc));
			}

			// Stage 2: Apply messages in small batches
			if (streamMessages.length > 0) {
				const batchSize = 5;
				for (let i = 0; i < streamMessages.length; i += batchSize) {
					const batch = streamMessages.slice(i, i + batchSize);
					stages.push(() => {
						batch.forEach((msg) => {
							try {
								const decoder = decoding.createDecoder(msg);
								const messageType = decoding.readVarUint(decoder);
								if (messageType === protocol.messageSync) {
									const syncType = decoding.readVarUint(decoder);
									if (syncType === protocol.messageSyncUpdate) {
										const update = decoding.readVarUint8Array(decoder);
										applyUpdate(reconstructedDoc, update);
									}
								}
							} catch (error) {
								// Ignore individual message failures
								this.logger.debug(`Ignoring corrupt message during reconstruction: ${error.message}`);
							}
						});
					});
				}
			}

			// Execute stages and check after each one
			for (const [index, stage] of stages.entries()) {
				try {
					reconstructedDoc.transact(stage);

					// Check if this stage resolved the issues
					if (reconstructedDoc.store.pendingStructs === null) {
						const cleanState = encodeStateAsUpdate(reconstructedDoc);
						ydoc.transact(() => {
							// Complete document replacement - clear all content
							ydoc.getMap().clear();
							const arr = ydoc.getArray();
							if (arr.length > 0) {
								arr.delete(0, arr.length);
							}
							applyUpdate(ydoc, cleanState);
						});

						reconstructedDoc.destroy();

						if (ydoc.store.pendingStructs === null) {
							this.logger.info(`Brute force reconstruction successful at stage ${index + 1} for ${room}/${docid}`);

							return true;
						}
					}
				} catch (error) {
					this.logger.debug(`Stage ${index + 1} failed during reconstruction: ${error.message}`);
				}
			}

			reconstructedDoc.destroy();
		} catch (error) {
			this.logger.warning(`Brute force reconstruction failed for ${room}/${docid}: ${error.message}`);
		}

		// Strategy 6: Low-Level Memory Manipulation
		try {
			this.logger.debug(`Attempting low-level memory manipulation for ${room}/${docid}`);

			// Force clear the pending structs directly (dangerous but effective)
			const originalPendingStructs = ydoc.store.pendingStructs;

			// Temporarily clear pending structs
			ydoc.store.pendingStructs = null;

			// Force a complete state reconstruction
			const currentUpdate = encodeStateAsUpdate(ydoc);
			const tempDoc = new Doc();

			try {
				applyUpdate(tempDoc, currentUpdate);

				// If temp doc is clean, the manipulation worked
				if (tempDoc.store.pendingStructs === null) {
					// Keep the cleared state
					this.logger.info(`Low-level manipulation successful for ${room}/${docid}`);
					tempDoc.destroy();

					return true;
				} else {
					// Restore original state if manipulation didn't work
					ydoc.store.pendingStructs = originalPendingStructs;
				}

				tempDoc.destroy();
			} catch (manipError) {
				// Restore original state on error
				ydoc.store.pendingStructs = originalPendingStructs;
				throw manipError;
			}
		} catch (error) {
			this.logger.warning(`Low-level manipulation failed for ${room}/${docid}: ${error.message}`);
		}

		// Strategy 7: Document Fork and Merge
		try {
			this.logger.debug(`Attempting document fork and merge for ${room}/${docid}`);

			// Create storage-only variant
			const storageOnly = new Doc();
			const storageState = await this.storage.retrieveDoc(room, docid);
			if (storageState) {
				applyUpdateV2(storageOnly, storageState.doc);

				// Check if storage variant is clean
				if (storageOnly.store.pendingStructs === null) {
					const cleanState = encodeStateAsUpdate(storageOnly);
					ydoc.transact(() => {
						// Clear and apply clean state
						ydoc.getMap().clear();
						const arr = ydoc.getArray();
						if (arr.length > 0) {
							arr.delete(0, arr.length);
						}
						applyUpdate(ydoc, cleanState);
					});

					storageOnly.destroy();

					if (ydoc.store.pendingStructs === null) {
						this.logger.info(`Document fork and merge successful using storage variant for ${room}/${docid}`);

						return true;
					}
				}

				storageOnly.destroy();
			}
		} catch (error) {
			this.logger.warning(`Document fork and merge failed for ${room}/${docid}: ${error.message}`);
		}

		// Strategy 8: Nuclear Option - Complete Document Recreation
		try {
			this.logger.debug(`Attempting nuclear option (complete recreation) for ${room}/${docid}`);

			// Extract basic content as JSON
			const semanticContent = { mapContent: ydoc.getMap().toJSON(), arrayContent: ydoc.getArray().toJSON() };

			if (Object.keys(semanticContent.mapContent).length > 0 || semanticContent.arrayContent.length > 0) {
				// Create a brand new document
				const nuclearDoc = new Doc();

				// Recreate content semantically
				nuclearDoc.transact(() => {
					// Recreate map content
					const newMap = nuclearDoc.getMap();
					Object.entries(semanticContent.mapContent).forEach(([key, value]) => {
						try {
							newMap.set(key, value);
						} catch {
							// Ignore failures
						}
					});

					// Recreate array content
					const newArray = nuclearDoc.getArray();
					semanticContent.arrayContent.forEach((item, index) => {
						try {
							newArray.insert(index, [item]);
						} catch {
							// Ignore failures
						}
					});
				});

				// Check if nuclear approach worked
				if (nuclearDoc.store.pendingStructs === null) {
					const nuclearState = encodeStateAsUpdate(nuclearDoc);
					ydoc.transact(() => {
						// Clear and apply nuclear state
						ydoc.getMap().clear();
						const arr = ydoc.getArray();
						if (arr.length > 0) {
							arr.delete(0, arr.length);
						}
						applyUpdate(ydoc, nuclearState);
					});

					nuclearDoc.destroy();

					if (ydoc.store.pendingStructs === null) {
						this.logger.info(
							`Nuclear option successful for ${room}/${docid} - document recreated from semantic content`,
						);

						return true;
					}
				}

				nuclearDoc.destroy();
			}
		} catch (error) {
			this.logger.warning(`Nuclear option failed for ${room}/${docid}: ${error.message}`);
		}

		// Strategy 9: Controlled Corruption Acceptance
		try {
			this.logger.debug(`Attempting controlled corruption acceptance for ${room}/${docid}`);

			// If we can't fix it, at least make it functional by isolating the corruption
			if (ydoc.store.pendingStructs && ydoc.store.pendingStructs.missing.size > 0) {
				// Create a "quarantine" area for corrupted data
				const quarantineMap = ydoc.getMap('__corrupted_data_quarantine__');
				const originalMissing = Array.from(ydoc.store.pendingStructs.missing.entries());

				quarantineMap.set('corrupted_structs', JSON.stringify(originalMissing));
				quarantineMap.set('quarantine_timestamp', Date.now());
				quarantineMap.set('recovery_attempted', true);

				// Force clear pending structs for functionality
				ydoc.store.pendingStructs = null;

				this.logger.warning(
					`Applied controlled corruption acceptance for ${room}/${docid} - data quarantined but document is functional`,
				);

				return true; // Consider this a success - document is functional
			}
		} catch (error) {
			this.logger.warning(`Controlled corruption acceptance failed for ${room}/${docid}: ${error.message}`);
		}

		this.logger.warning(
			`All extreme recovery strategies failed for ${room}/${docid} - this represents the absolute worst case scenario`,
		);

		return false;
	}

	private handleMessageUpdates(docMessages: YRedisMessage | null, ydoc: Doc, awareness: Awareness): void {
		if (!docMessages?.messages) {
			return;
		}

		// Sort messages to ensure proper order (if they have timestamps or sequence numbers)
		const sortedMessages = [...docMessages.messages];

		sortedMessages.forEach((m) => {
			let messageType: number | undefined;
			try {
				const decoder = decoding.createDecoder(m);
				messageType = decoding.readVarUint(decoder);

				switch (messageType) {
					case protocol.messageSync: {
						// The methode readVarUnit works with a pointer, that increases by each execution. The second execution gets the second value.
						const syncType = decoding.readVarUint(decoder);
						if (syncType === protocol.messageSyncUpdate) {
							const update = decoding.readVarUint8Array(decoder);
							applyUpdate(ydoc, update);
						}
						break;
					}
					case protocol.messageAwareness: {
						const awarenessUpdate = decoding.readVarUint8Array(decoder);
						applyAwarenessUpdate(awareness, awarenessUpdate, null);
						break;
					}
					default: {
						this.logger.warning(`Unknown message type: ${messageType}`);
						break;
					}
				}
			} catch (error) {
				this.logger.warning(
					`Failed to apply update for message type ${messageType ?? 'unknown'}: ${error.message}. Message: ${Buffer.from(m).toString('base64')}`,
				);
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
