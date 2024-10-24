/* This file contains the implementation of the functions,
    which was copied from the y-redis repository.
	Adopting this code allows us to integrate proven and
	optimized logic into the current project.
	The original code from the `y-redis` repository is licensed under the AGPL-3.0 license.
	By adhering to the license terms, we ensure that the use of the code from the `y-redis` repository is legally compliant.
*/
/* eslint-disable max-classes-per-file */
import * as array from 'lib0/array';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import * as promise from 'lib0/promise';
import * as uws from 'uws';
import * as Y from 'yjs';
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

class YWebsocketServer {
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

class User {
	public subs: Set<string>;
	public id: number;
	public awarenessId: number | null;
	public awarenessLastClock: number;
	public isClosed: boolean;
	public initialRedisSubId: string;

	public constructor(
		public readonly room: string,
		public readonly hasWriteAccess: boolean,
		/**
		 * Identifies the User globally.
		 * Note that several clients can have the same userid (e.g. if a user opened several browser
		 * windows)
		 */
		public readonly userid: string,
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

/**
 * @param {uws.TemplatedApp} app
 * @param {uws.RecognizedString} pattern
 * @param {import('./storage.js').AbstractStorage} store
 * @param {function(uws.HttpRequest): Promise<{ hasWriteAccess: boolean, room: string, userid: string, error: Partial<CloseEvent> | null }>} checkAuth
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
	checkAuth: any,
	options: {
		initDocCallback?: (room: string, docname: string, client: Api) => void;
		openWsCallback?: (ws: uws.WebSocket<User>) => void;
		closeWsCallback?: (ws: uws.WebSocket<User>, code: number, message: ArrayBuffer) => void;
	},
	createRedisInstance: RedisService,
) => {
	const { initDocCallback, openWsCallback, closeWsCallback } = options;
	const [client, subscriber] = await promise.all([
		createApiClient(store, createRedisInstance),
		createSubscriber(store, createRedisInstance),
	]);
	/**
	 * @param {string} stream
	 * @param {Array<Uint8Array>} messages
	 */
	const redisMessageSubscriber = (stream: string, messages: any[]): void => {
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
		upgrade: async (res, req, context) => {
			try {
				const url = req.getUrl();
				const headerWsKey = req.getHeader('sec-websocket-key');
				const headerWsProtocol = req.getHeader('sec-websocket-protocol');
				const headerWsExtensions = req.getHeader('sec-websocket-extensions');
				let aborted = false;
				res.onAborted(() => {
					console.log('Upgrading client aborted', { url });
					aborted = true;
				});
				try {
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
				} catch (err) {
					console.log(`Failed to auth to endpoint ${url}`, err);
					if (aborted) return;
					res.cork(() => {
						res.writeStatus('401 Unauthorized').end('Unauthorized');
					});
				}
			} catch (error) {
				res.cork(() => {
					res.writeStatus('500 Internal Server Error').end('Internal Server Error');
				});
				console.error(error);
			}
		},
		open: async (ws: uws.WebSocket<User>) => {
			try {
				const user = ws.getUserData() as User;

				console.log(`client connected (uid='${user.id}', ip='${Buffer.from(ws.getRemoteAddressAsText()).toString()}'`);

				if (user.error != null) {
					console.log('Closing connection because of error', user.error);
					const { code, reason } = user.error;
					ws.end(code, reason);

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
		},
		message: (ws, messageBuffer) => {
			try {
				const user = ws.getUserData() as User;
				// don't read any messages from users without write access
				if (!user.hasWriteAccess) return;
				// It is important to copy the data here
				const message = Buffer.from(messageBuffer.slice(0, messageBuffer.byteLength));
				if (
					// filter out messages that we simply want to propagate to all clients
					// sync update or sync step 2
					(message[0] === protocol.messageSync &&
						(message[1] === protocol.messageSyncUpdate || message[1] === protocol.messageSyncStep2)) ||
					// awareness update
					message[0] === protocol.messageAwareness
				) {
					if (message[0] === protocol.messageAwareness) {
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
		},
		close: (ws, code, message) => {
			try {
				const user = ws.getUserData() as User;
				user.awarenessId &&
					client.addMessage(
						user.room,
						'index',
						Buffer.from(protocol.encodeAwarenessUserDisconnected(user.awarenessId, user.awarenessLastClock)),
					);
				user.isClosed = true;
				console.log(
					`client connection closed (uid='${user.id}', code='${code}', message='${Buffer.from(message).toString()}`,
				);

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
		},
	});

	return new YWebsocketServer(app, client, subscriber);
};
