/* This file contains the implementation of the functions,
    which was copied from the y-redis repository.
	Adopting this code allows us to integrate proven and
	optimized logic into the current project.
	The original code from the `y-redis` repository is licensed under the AGPL-3.0 license.
	https://github.com/yjs/y-redis
*/
/* eslint-disable max-classes-per-file */
import * as array from 'lib0/array';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import * as promise from 'lib0/promise';
import * as uws from 'uWebSockets.js';
import * as Y from 'yjs';
import { ResponsePayload } from '../authorization/interfaces/response.payload.js';
import { RedisService } from '../redis/redis.service.js';
import { Api, createApiClient } from './api.service.js';
import { computeRedisRoomStreamName, isSmallerRedisId } from './helper.js';
import * as protocol from './protocol.js';
import { DocumentStorage } from './storage.js';
import { createSubscriber, Subscriber } from './subscriber.service.js';

/**
 * how to sync
 *   receive sync-step 1
 *   // @todo y-websocket should only accept updates after receiving sync-step 2
 *   redisId = ws.sub(conn)
 *   {doc,redisDocLastId} = api.getdoc()
 *   compute sync-step 2
 *   if (redisId > redisDocLastId) {
 *     subscriber.ensureId(redisDocLastId)
 *   }
 */

export class YWebsocketServer {
	public constructor(
		public readonly app: uws.TemplatedApp,
		public readonly client: Api,
		public readonly subscriber: Subscriber,
	) {}

	public async destroy(): Promise<void> {
		this.subscriber.destroy();
		await this.client.destroy();
	}
}

let _idCnt = 0;

export class User {
	public subs: Set<string>;
	public id: number;
	public awarenessId: number | null;
	public awarenessLastClock: number;
	public isClosed: boolean;
	public initialRedisSubId: string;

	public constructor(
		public readonly room: string | null,
		public readonly hasWriteAccess: boolean,
		/**
		 * Identifies the User globally.
		 * Note that several clients can have the same userid (e.g. if a user opened several browser
		 * windows)
		 */
		public readonly userid: string | null,
		public readonly error: Partial<CloseEvent> | null = null,
	) {
		this.initialRedisSubId = '0';
		this.subs = new Set();
		/**
		 * This is just an identifier to keep track of the user for logging purposes.
		 */
		this.id = _idCnt++;
		this.awarenessId = null;
		this.awarenessLastClock = 0;
		this.isClosed = false;
	}
}

export const upgradeCallback = async (
	res: uws.HttpResponse,
	req: uws.HttpRequest,
	context: uws.us_socket_context_t,
	checkAuth: (req: uws.HttpRequest) => Promise<ResponsePayload>,
): Promise<void> => {
	try {
		const headerWsKey = req.getHeader('sec-websocket-key');
		const headerWsProtocol = req.getHeader('sec-websocket-protocol');
		const headerWsExtensions = req.getHeader('sec-websocket-extensions');
		let aborted = false;
		res.onAborted(() => {
			aborted = true;
		});

		const { hasWriteAccess, room, userid, error } = await checkAuth(req);
		if (aborted) return;
		res.cork(() => {
			res.upgrade(
				new User(room, hasWriteAccess, userid, error),
				headerWsKey,
				headerWsProtocol,
				headerWsExtensions,
				context,
			);
		});
	} catch (error) {
		res.cork(() => {
			res.writeStatus('500 Internal Server Error').end('Internal Server Error');
		});
		console.error(error);
	}
};

export const openCallback = async (
	ws: uws.WebSocket<User>,
	subscriber: Subscriber,
	client: Api,
	redisMessageSubscriber: (stream: string, messages: Uint8Array[]) => void,
	openWsCallback?: (ws: uws.WebSocket<User>) => void,
	initDocCallback?: (room: string, docname: string, client: Api) => void,
): Promise<void> => {
	try {
		const user = ws.getUserData();
		if (user.error != null) {
			const { code, reason } = user.error;
			ws.end(code, reason);

			return;
		}

		if (user.room === null || user.userid === null) {
			ws.end(1008);

			return;
		}

		if (openWsCallback) {
			openWsCallback(ws);
		}
		const stream = computeRedisRoomStreamName(user.room, 'index', client.redisPrefix);
		user.subs.add(stream);
		ws.subscribe(stream);
		user.initialRedisSubId = subscriber.subscribe(stream, redisMessageSubscriber).redisId;
		const indexDoc = await client.getDoc(user.room, 'index');
		if (indexDoc.ydoc.store.clients.size === 0) {
			if (initDocCallback) {
				initDocCallback(user.room, 'index', client);
			}
		}
		if (user.isClosed) return;
		ws.cork(() => {
			ws.send(protocol.encodeSyncStep1(Y.encodeStateVector(indexDoc.ydoc)), true, false);
			ws.send(protocol.encodeSyncStep2(Y.encodeStateAsUpdate(indexDoc.ydoc)), true, true);
			if (indexDoc.awareness.states.size > 0) {
				ws.send(
					protocol.encodeAwarenessUpdate(indexDoc.awareness, array.from(indexDoc.awareness.states.keys())),
					true,
					true,
				);
			}
		});

		// awareness is destroyed here to avoid memory leaks, see: https://github.com/yjs/y-redis/issues/24
		indexDoc.awareness.destroy();

		if (isSmallerRedisId(indexDoc.redisLastId, user.initialRedisSubId)) {
			// our subscription is newer than the content that we received from the api
			// need to renew subscription id and make sure that we catch the latest content.
			subscriber.ensureSubId(stream, indexDoc.redisLastId);
		}
	} catch (error) {
		console.error(error);
		ws.end(1011);
	}
};

const isAwarenessUpdate = (message: Buffer): boolean => message[0] === protocol.messageAwareness;
const isSyncUpdateOrSyncStep2OrAwarenessUpdate = (message: Buffer): boolean =>
	(message[0] === protocol.messageSync &&
		(message[1] === protocol.messageSyncUpdate || message[1] === protocol.messageSyncStep2)) ||
	isAwarenessUpdate(message);

export const messageCallback = (ws: uws.WebSocket<User>, messageBuffer: ArrayBuffer, client: Api): void => {
	try {
		const user = ws.getUserData();
		// don't read any messages from users without write access
		if (!user.hasWriteAccess || !user.room) return;
		// It is important to copy the data here
		const message = Buffer.from(messageBuffer.slice(0, messageBuffer.byteLength));

		if (
			// filter out messages that we simply want to propagate to all clients
			// sync update or sync step 2
			// awareness update
			isSyncUpdateOrSyncStep2OrAwarenessUpdate(message)
		) {
			if (isAwarenessUpdate(message)) {
				const decoder = decoding.createDecoder(message);
				decoding.readVarUint(decoder); // read message type
				decoding.readVarUint(decoder); // read length of awareness update
				const alen = decoding.readVarUint(decoder); // number of awareness updates
				const awId = decoding.readVarUint(decoder);
				if (alen === 1 && (user.awarenessId === null || user.awarenessId === awId)) {
					// only update awareness if len=1
					user.awarenessId = awId;
					user.awarenessLastClock = decoding.readVarUint(decoder);
				}
			}
			client.addMessage(user.room, 'index', message);
		} else if (message[0] === protocol.messageSync && message[1] === protocol.messageSyncStep1) {
			// sync step 1
			// can be safely ignored because we send the full initial state at the beginning
		} else {
			console.error('Unexpected message type', message);
		}
	} catch (error) {
		console.error(error);
		ws.end(1011);
	}
};

export const closeCallback = (
	app: uws.TemplatedApp,
	ws: uws.WebSocket<User>,
	client: Api,
	subscriber: Subscriber,
	code: number,
	message: ArrayBuffer,
	redisMessageSubscriber: (stream: string, messages: Uint8Array[]) => void,
	closeWsCallback?: (ws: uws.WebSocket<User>, code: number, message: ArrayBuffer) => void,
): void => {
	try {
		const user = ws.getUserData();
		if (!user.room) return;

		user.awarenessId &&
			client.addMessage(
				user.room,
				'index',
				Buffer.from(protocol.encodeAwarenessUserDisconnected(user.awarenessId, user.awarenessLastClock)),
			);
		user.isClosed = true;

		if (closeWsCallback) {
			closeWsCallback(ws, code, message);
		}
		user.subs.forEach((topic) => {
			if (app.numSubscribers(topic) === 0) {
				subscriber.unsubscribe(topic, redisMessageSubscriber);
			}
		});
	} catch (error) {
		console.error(error);
	}
};

/**
 * @param {uws.TemplatedApp} app
 * @param {uws.RecognizedString} pattern
 * @param {import('./storage.js').AbstractStorage} store
 * @param {function(uws.HttpRequest): Promise<ResponsePayload>} checkAuth
 * @param {Object} conf
 * @param {string} [conf.redisPrefix]
 * @param {(room:string,docname:string,client:api.Api)=>void} [conf.initDocCallback] - this is called when a doc is
 * accessed, but it doesn't exist. You could populate the doc here. However, this function could be
 * called several times, until some content exists. So you need to handle concurrent calls.
 * @param {(ws:uws.WebSocket<User>)=>void} [conf.openWsCallback] - called when a websocket connection is opened
 * @param {(ws:uws.WebSocket<User>,code:number,message:ArrayBuffer)=>void} [conf.closeWsCallback] - called when a websocket connection is closed
 * @param {() => Promise<import('redis').RedisClientType | import('ioredis').Redis>} createRedisInstance
 */
export const registerYWebsocketServer = async (
	app: uws.TemplatedApp,
	pattern: string,
	store: DocumentStorage,
	checkAuth: (req: uws.HttpRequest) => Promise<ResponsePayload>,
	options: {
		initDocCallback?: (room: string, docname: string, client: Api) => void;
		openWsCallback?: (ws: uws.WebSocket<User>) => void;
		closeWsCallback?: (ws: uws.WebSocket<User>, code: number, message: ArrayBuffer) => void;
	},
	createRedisInstance: RedisService,
): Promise<YWebsocketServer> => {
	const { initDocCallback, openWsCallback, closeWsCallback } = options;
	const [client, subscriber] = await promise.all([
		createApiClient(store, createRedisInstance),
		createSubscriber(store, createRedisInstance),
	]);

	const redisMessageSubscriber = (stream: string, messages: Uint8Array[]): void => {
		if (app.numSubscribers(stream) === 0) {
			subscriber.unsubscribe(stream, redisMessageSubscriber);
		}
		const message =
			messages.length === 1
				? messages[0]
				: encoding.encode((encoder) =>
						messages.forEach((message) => {
							encoding.writeUint8Array(encoder, message);
						}),
					);
		app.publish(stream, message, true, false);
	};

	app.ws(pattern, {
		compression: uws.SHARED_COMPRESSOR,
		maxPayloadLength: 100 * 1024 * 1024,
		idleTimeout: 60,
		sendPingsAutomatically: true,
		upgrade: (res, req, context) => upgradeCallback(res, req, context, checkAuth),
		open: (ws: uws.WebSocket<User>) =>
			openCallback(ws, subscriber, client, redisMessageSubscriber, openWsCallback, initDocCallback),
		message: (ws, messageBuffer) => messageCallback(ws, messageBuffer, client),
		close: (ws, code, message) =>
			closeCallback(app, ws, client, subscriber, code, message, redisMessageSubscriber, closeWsCallback),
	});

	return new YWebsocketServer(app, client, subscriber);
};
