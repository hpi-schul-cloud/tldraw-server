import { array, decoding, promise } from 'lib0';
import { applyAwarenessUpdate, Awareness } from 'y-protocols/awareness';
import { applyUpdate, applyUpdateV2, Doc } from 'yjs';
import { StreamNameClockPair } from '../redis/interfaces/stream-name-clock-pair.js';
import { RedisAdapter } from '../redis/redis.adapter.js';
import { RedisService } from '../redis/redis.service.js';
import { computeRedisRoomStreamName, extractMessagesFromStreamReply } from './helper.js';
import { YRedisMessage } from './interfaces/stream-message.js';
import * as protocol from './protocol.js';
import { DocumentStorage } from './storage.js';

export const createApiClient = async (store: DocumentStorage, createRedisInstance: RedisService): Promise<Api> => {
	const a = new Api(store, await createRedisInstance.createRedisInstance());

	await a.redis.createGroup();

	return a;
};

export class Api {
	public readonly redisPrefix: string;
	public _destroyed;

	public constructor(
		private readonly store: DocumentStorage,
		public readonly redis: RedisAdapter,
	) {
		this.store = store;
		this.redisPrefix = redis.redisPrefix;
		this._destroyed = false;
	}

	public async getMessages(streams: StreamNameClockPair[]): Promise<YRedisMessage[]> {
		if (streams.length === 0) {
			await promise.wait(50);

			return [];
		}

		const streamReplyRes = await this.redis.readStreams(streams);

		const res: YRedisMessage[] = [];

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

		return this.redis.addMessage(computeRedisRoomStreamName(room, docid, this.redisPrefix), m);
	}

	public getStateVector(room: string, docid = '/'): Promise<Uint8Array | null> {
		return this.store.retrieveStateVector(room, docid);
	}

	public async getDoc(
		room: string,
		docid: string,
	): Promise<{
		ydoc: Doc;
		awareness: Awareness;
		redisLastId: string;
		storeReferences: string[] | null;
		docChanged: boolean;
	}> {
		const roomComputed = computeRedisRoomStreamName(room, docid, this.redisPrefix);
		const ms = extractMessagesFromStreamReply(await this.redis.readMessagesFromStream(roomComputed), this.redisPrefix);

		const docMessages = ms.get(room)?.get(docid) ?? null;
		const docstate = await this.store.retrieveDoc(room, docid);

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

	public async destroy(): Promise<void> {
		this._destroyed = true;
		await this.redis.quit();
	}
}
