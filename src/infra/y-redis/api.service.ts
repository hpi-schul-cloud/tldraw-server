import { RedisService } from 'infra/redis/redis.service.js';
import { Redis } from 'ioredis';
import { array, decoding, map, math, number, promise } from 'lib0';
import { applyAwarenessUpdate, Awareness } from 'y-protocols/awareness.js';
import { applyUpdate, applyUpdateV2, Doc } from 'yjs';
import { computeRedisRoomStreamName, decodeRedisRoomStreamName } from './helper.js';
import * as protocol from './protocol.js';
import { StreamsMessagesReply } from './redis/interfaces/stream-message-replay.js';
import { StreamMessage } from './redis/interfaces/stream-message.js';
import { StreamNameClockPair } from './redis/interfaces/stream-name-clock-pair.js';
import { IoRedisAdapter } from './redis/io-redis.js';
import { AbstractStorage } from './storage.js';

export const createApiClient = async (
	store: AbstractStorage,
	redisPrefix: string,
	createRedisInstance: RedisService,
): Promise<Api> => {
	const a = new Api(store, redisPrefix, await createRedisInstance.createRedisInstance());
	try {
		await a.redis.createGroup();
	} catch (e) {
		// It is okay when the group already exists, so we can ignore this error.
		// @ts-ignore
		if (e.message !== 'BUSYGROUP Consumer Group name already exists') {
			throw e;
		}
	}

	return a;
};

const extractMessagesFromStreamReply = (streamReply: StreamsMessagesReply, prefix: string) => {
	const messages = new Map<string, Map<string, { lastId: string; messages: Uint8Array[] }>>();

	streamReply?.forEach((docStreamReply) => {
		const { room, docid } = decodeRedisRoomStreamName(docStreamReply.name.toString(), prefix);
		const docMessages = map.setIfUndefined(map.setIfUndefined(messages, room, map.create), docid, () => ({
			// @ts-ignore
			lastId: array.last(docStreamReply.messages).id,
			messages: [] as Uint8Array[],
		}));
		docStreamReply.messages?.forEach((m) => {
			if (m.message.m != null) {
				// @ts-ignore
				docMessages.messages.push(m.message.m);
			}
		});
	});

	return messages;
};

export class Api {
	private readonly consumername: string;
	private readonly redisTaskDebounce;
	private readonly redisMinMessageLifetime;
	public _destroyed;
	public readonly redis;

	public constructor(
		private readonly store: AbstractStorage,
		private readonly prefix: string,
		private readonly redisInstance: Redis,
	) {
		this.store = store;
		this.prefix = prefix;
		this.consumername = Date.now().toString(); //uuidv4();
		/**
		 * After this timeout, a worker will pick up a task and clean up a stream.
		 */
		this.redisTaskDebounce = parseInt('10000'); // default: 10 seconds env.getConf('redis-task-debounce') ||
		/**
		 * Minimum lifetime of y* update messages in redis streams.
		 */
		this.redisMinMessageLifetime = parseInt('60000'); // default: 1 minute env.getConf('redis-min-message-lifetime') ||
		this._destroyed = false;

		this.redis = new IoRedisAdapter(this.redisInstance, this.prefix);
	}

	public async getMessages(streams: StreamNameClockPair[]): Promise<StreamMessage[]> {
		if (streams.length === 0) {
			await promise.wait(50);

			return [];
		}

		const streamReplyRes = await this.redis.readStreams(streams);

		const res: StreamMessage[] = [];

		streamReplyRes?.forEach((stream) => {
			res.push({
				stream: stream.name.toString(),
				// @ts-ignore
				messages: protocol.mergeMessages(stream.messages.map((message) => message.message.m).filter((m) => m != null)),
				lastId: stream.messages ? array.last(stream.messages).id.toString() : '',
			});
		});

		return res;
	}

	/**
	 * @param {string} room
	 * @param {string} docid
	 * @param {Buffer} m
	 */
	public addMessage(room: string, docid: string, m: Buffer): Promise<unknown> {
		// handle sync step 2 like a normal update message
		if (m[0] === protocol.messageSync && m[1] === protocol.messageSyncStep2) {
			if (m.byteLength < 4) {
				// message does not contain any content, don't distribute
				return promise.resolve();
			}
			m[1] = protocol.messageSyncUpdate;
		}

		return this.redis.addMessage(computeRedisRoomStreamName(room, docid, this.prefix), m);
	}

	public getStateVector(room: string, docid = '/'): Promise<Uint8Array | null> {
		return this.store.retrieveStateVector(room, docid);
	}

	public async getDoc(room: string, docid: string): Promise<any> {
		console.log(`getDoc(${room}, ${docid})`);
		const ms = extractMessagesFromStreamReply(
			await this.redis.readMessagesFromStream(computeRedisRoomStreamName(room, docid, this.prefix)),
			this.prefix,
		);
		console.log(`getDoc(${room}, ${docid}) - retrieved messages`);
		const docMessages = ms.get(room)?.get(docid) || null;
		const docstate = await this.store.retrieveDoc(room, docid);
		console.log(`getDoc(${room}, ${docid}) - retrieved doc`);
		const ydoc = new Doc();
		const awareness = new Awareness(ydoc);
		awareness.setLocalState(null); // we don't want to propagate awareness state
		if (docstate) {
			applyUpdateV2(ydoc, docstate.doc);
		}
		let docChanged = false;
		ydoc.once('afterTransaction', (tr) => {
			docChanged = tr.changed.size > 0;
		});
		ydoc.transact(() => {
			docMessages?.messages.forEach((m) => {
				const decoder = decoding.createDecoder(m);
				switch (decoding.readVarUint(decoder)) {
					case 0: {
						// sync message
						if (decoding.readVarUint(decoder) === 2) {
							// update message
							applyUpdate(ydoc, decoding.readVarUint8Array(decoder));
						}
						break;
					}
					case 1: {
						// awareness message
						applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), null);
						break;
					}
				}
			});
		});

		return {
			ydoc,
			awareness,
			redisLastId: docMessages?.lastId.toString() ?? '0',
			storeReferences: docstate?.references ?? null,
			docChanged,
		};
	}

	public async consumeWorkerQueue(tryClaimCount = 5): Promise<{ stream: string; id: string }[]> {
		const tasks: { stream: string; id: string }[] = [];
		const reclaimedTasks = await this.redis.reclaimTasks(this.consumername, this.redisTaskDebounce, tryClaimCount);
		const deletedDocEntries = await this.redis.getDeletedDocEntries();
		const deletedDocNames = deletedDocEntries?.map((entry) => {
			return entry.message.docName;
		});

		reclaimedTasks?.messages?.forEach((m) => {
			const stream = m?.message.compact;
			stream && tasks.push({ stream: stream.toString(), id: m?.id.toString() });
		});
		if (tasks.length === 0) {
			console.log('WORKER: No tasks available, pausing..', { tasks });
			await promise.wait(1000);

			return [];
		}
		console.log('WORKER: Accepted tasks ', { tasks });
		await promise.all(
			tasks.map(async (task) => {
				const streamlen = await this.redis.tryClearTask(task);
				const { room, docid } = decodeRedisRoomStreamName(task.stream, this.prefix);
				if (streamlen === 0) {
					console.log('WORKER: Stream still empty, removing recurring task from queue ', { stream: task.stream });

					const deleteEntryId = deletedDocEntries.find((entry) => entry.message.docName === task.stream)?.id.toString();

					if (deleteEntryId) {
						this.redis.deleteDeleteDocEntry(deleteEntryId);
						this.store.deleteDocument(room, docid);
					}
				} else {
					// @todo, make sure that awareness by this.getDoc is eventually destroyed, or doesn't
					// register a timeout anymore
					console.log('WORKER: requesting doc from store');
					const { ydoc, storeReferences, redisLastId, docChanged, awareness } = await this.getDoc(room, docid);

					// awareness is destroyed here to avoid memory leaks, see: https://github.com/yjs/y-redis/issues/24
					awareness.destroy();
					console.log(
						'WORKER: retrieved doc from store. redisLastId=' + redisLastId,
						' storeRefs=' + JSON.stringify(storeReferences),
					);
					const lastId = math.max(number.parseInt(redisLastId.split('-')[0]), parseInt(task.id.split('-')[0]));
					if (docChanged) {
						console.log('WORKER: persisting doc');
						if (!deletedDocNames.includes(task.stream)) {
							await this.store.persistDoc(room, docid, ydoc);
						}
					}
					await promise.all([
						storeReferences && docChanged
							? this.store.deleteReferences(room, docid, storeReferences)
							: promise.resolve(),
						this.redis.tryDeduplicateTask(task, lastId, this.redisMinMessageLifetime),
					]);
					console.log('WORKER: Compacted stream ', {
						stream: task.stream,
						taskId: task.id,
						newLastId: lastId - this.redisMinMessageLifetime,
					});
				}
			}),
		);

		return tasks;
	}

	public async destroy(): Promise<void> {
		this._destroyed = true;
		try {
			await this.redis.quit();
		} catch (e) {
			console.error(e);
		}
	}
}
