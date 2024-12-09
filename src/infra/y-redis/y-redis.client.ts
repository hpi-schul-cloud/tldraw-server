import { OnModuleInit } from '@nestjs/common';
import { array, decoding, promise } from 'lib0';
import { applyAwarenessUpdate, Awareness } from 'y-protocols/awareness';
import { applyUpdate, applyUpdateV2, Doc } from 'yjs';
import { MetricsService } from '../metrics/metrics.service.js';
import { RedisAdapter, StreamNameClockPair } from '../redis/interfaces/index.js';
import { computeRedisRoomStreamName, extractMessagesFromStreamReply } from './helper.js';
import { YRedisMessage } from './interfaces/stream-message.js';
import { YRedisDoc } from './interfaces/y-redis-doc.js';
import * as protocol from './protocol.js';
import { DocumentStorage } from './storage.js';

export const handleMessageUpdates = (docMessages: YRedisMessage | null, ydoc: Doc, awareness: Awareness): void => {
	docMessages?.messages.forEach((m) => {
		const decoder = decoding.createDecoder(m);
		const messageType = decoding.readVarUint(decoder);
		switch (messageType) {
			case protocol.messageSync: {
				// The methode readVarUnit work with pointer, that increase by each execution. The second execution get the second value.
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
};

type CallbackFunction = () => void;

export class YRedisClient implements OnModuleInit {
	public readonly redisPrefix: string;
	public _destroyed; // TODO: should be private
	private destroyedCallback: CallbackFunction;

	public constructor(
		private readonly store: DocumentStorage, // TODO: Naming?
		public readonly redis: RedisAdapter,
	) {
		this.store = store;
		this.redisPrefix = redis.redisPrefix;
		this._destroyed = false;
		this.destroyedCallback = (): void => {
			// Empty callback
		};
	}
	public async onModuleInit(): Promise<void> {
		await this.redis.createGroup();
	}

	public registerDestroyedCallback(callback: CallbackFunction): void {
		this.destroyedCallback = callback;
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

	public async getDoc(room: string, docid: string): Promise<YRedisDoc> {
		const end = MetricsService.methodDurationHistogram.startTimer();
		let docChanged = false;

		const roomComputed = computeRedisRoomStreamName(room, docid, this.redisPrefix);
		const streamReply = await this.redis.readMessagesFromStream(roomComputed);

		const ms = extractMessagesFromStreamReply(streamReply, this.redisPrefix);

		const docMessages = ms.get(room)?.get(docid) ?? null;
		const docstate = await this.store.retrieveDoc(room, docid);

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
			handleMessageUpdates(docMessages, ydoc, awareness);
		});

		end();

		const response = {
			ydoc,
			awareness,
			redisLastId: docMessages?.lastId.toString() ?? '0',
			storeReferences: docstate?.references ?? null,
			docChanged,
		};

		if (ydoc.store.pendingStructs !== null) {
			console.warn(`Document ${room} has pending structs ${JSON.stringify(ydoc.store.pendingStructs)}.`);
		}

		return response;
	}

	public async destroy(): Promise<void> {
		this.destroyedCallback();
		this._destroyed = true;
		await this.redis.quit();
	}
}
