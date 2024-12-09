import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { encoding } from 'lib0';
import {
	HttpRequest,
	HttpResponse,
	SHARED_COMPRESSOR,
	TemplatedApp,
	us_socket_context_t,
	WebSocket,
} from 'uWebSockets.js';
import { AuthorizationService } from '../../../infra/authorization/authorization.service.js';
import { Logger } from '../../../infra/logger/index.js';
import { MetricsService } from '../../../infra/metrics/metrics.service.js';
import { RedisAdapter } from '../../../infra/redis/interfaces/redis-adapter.js';
import { computeRedisRoomStreamName, isSmallerRedisId } from '../../../infra/y-redis/helper.js';
import { Subscriber } from '../../../infra/y-redis/subscriber.service.js';
import { YRedisUser } from '../../../infra/y-redis/y-redis-user.js';
import { YRedisClient } from '../../../infra/y-redis/y-redis.client.js';
import { YRedisService } from '../../../infra/y-redis/y-redis.service.js';
import { REDIS_FOR_SUBSCRIBE_OF_DELETION, UWS } from '../server.const.js';
import { TldrawServerConfig } from '../tldraw-server.config.js';
import { YRedisDoc } from 'infra/y-redis/interfaces/y-redis-doc.js';

@Injectable()
export class WebsocketGateway implements OnModuleInit, OnModuleDestroy {
	public constructor(
		@Inject(UWS) private readonly webSocketServer: TemplatedApp,
		private readonly yRedisService: YRedisService,
		private readonly subscriberService: Subscriber,
		private readonly yRedisClient: YRedisClient,
		private readonly authorizationService: AuthorizationService,
		@Inject(REDIS_FOR_SUBSCRIBE_OF_DELETION) private readonly redisAdapter: RedisAdapter,
		private readonly config: TldrawServerConfig,
		private readonly logger: Logger,
	) {
		this.logger.setContext(WebsocketGateway.name);
	}

	public onModuleDestroy(): void {
		this.webSocketServer.close();
	}

	public onModuleInit(): void {
		const wsPathPrefix = this.config.TLDRAW_WEBSOCKET_PATH;
		const wsPort = this.config.TLDRAW_WEBSOCKET_PORT;
		this.subscriberService.start();

		this.webSocketServer.ws(`${wsPathPrefix}/:room`, {
			compression: SHARED_COMPRESSOR,
			maxPayloadLength: 100 * 1024 * 1024,
			idleTimeout: 60,
			sendPingsAutomatically: true,
			upgrade: (res, req, context) => this.upgradeCallback(res, req, context),
			open: (ws: WebSocket<YRedisUser>) => this.openCallback(ws),
			message: (ws, messageBuffer) => this.messageCallback(ws, messageBuffer),
			close: (ws) => this.closeCallback(ws),
		});

		this.webSocketServer.listen(wsPort, (t) => {
			if (t) {
				this.logger.log(`Websocket Server is running on port ${wsPort}`);
			}
		});

		this.redisAdapter.subscribeToDeleteChannel((message: string) => {
			this.webSocketServer.publish(message, 'action:delete');
		});
	}

	private async upgradeCallback(res: HttpResponse, req: HttpRequest, context: us_socket_context_t): Promise<void> {
		try {
			const headerWsKey = req.getHeader('sec-websocket-key');
			const headerWsProtocol = req.getHeader('sec-websocket-protocol');
			const headerWsExtensions = req.getHeader('sec-websocket-extensions');
			let aborted = false;
			res.onAborted(() => {
				aborted = true;
			});
			// @TODO: create factory method for YRedisUser
			const { hasWriteAccess, room, userid, error } = await this.authorizationService.hasPermission(req);
			if (aborted) return;
			res.cork(() => {
				res.upgrade(
					new YRedisUser(room, hasWriteAccess, userid, error),
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
	}

	private async openCallback(ws: WebSocket<YRedisUser>): Promise<void> {
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

			MetricsService.openConnectionsGauge.inc();

			const stream = computeRedisRoomStreamName(user.room, 'index', this.yRedisClient.redisPrefix);
			user.subs.add(stream);
			ws.subscribe(stream);

			user.initialRedisSubId = this.subscriberService.subscribe(stream, this.redisMessageSubscriber).redisId;

			const indexDoc = await this.yRedisClient.getDoc(user.room, 'index');

			if (user.isClosed) return;
			ws.cork(() => {
				ws.send(this.yRedisService.encodeSyncStep1StateVectorMessage(indexDoc.ydoc), true, false);
				ws.send(this.yRedisService.encodeSyncStep2StateAsUpdateMessage(indexDoc.ydoc), true, true);
				if (indexDoc.getAwarenessStateSize() > 0) {
					ws.send(this.yRedisService.encodeAwarenessUpdateMessage(indexDoc.awareness), true, true);
				}
			});

			this.destroyAwarenessToAvoidMemoryLeak(indexDoc);

			if (isSmallerRedisId(indexDoc.redisLastId, user.initialRedisSubId)) {
				// our subscription is newer than the content that we received from the api
				// need to renew subscription id and make sure that we catch the latest content.
				this.subscriberService.ensureSubId(stream, indexDoc.redisLastId);
			}
		} catch (error) {
			console.error(error);
			ws.end(1011);
		}
	}

	private destroyAwarenessToAvoidMemoryLeak(indexDoc: YRedisDoc): void {
		// awareness is destroyed here to avoid memory leaks, see: https://github.com/yjs/y-redis/issues/24
		indexDoc.awareness.destroy();
	}

	private readonly redisMessageSubscriber = (stream: string, messages: Uint8Array[]): void => {
		if (this.webSocketServer.numSubscribers(stream) === 0) {
			this.subscriberService.unsubscribe(stream, this.redisMessageSubscriber);
		}

		const message =
			messages.length === 1
				? messages[0]
				: encoding.encode((encoder) =>
						messages.forEach((message) => {
							encoding.writeUint8Array(encoder, message);
						}),
					);
		this.webSocketServer.publish(stream, message, true, false);
	};

	/* do not work ...but why?
	private updateMessageEncoding(messages: Uint8Array): void {
		encoding.encode((encoder) =>
			messages.forEach((message) => {
				encoding.writeUint8Array(encoder, message);
			}),
		);
	}
	*/
	private messageCallback(ws: WebSocket<YRedisUser>, messageBuffer: ArrayBuffer): void {
		try {
			const user = ws.getUserData();

			// don't read any messages from users without write access // TODO authorization check in private Methode, ts macht Probleme, das return hier sieht merkwürdig aus, warum kein throw?
			if (!user.hasWriteAccess || !user.room) return;

			const message = this.yRedisService.filterMessageForPropagation(messageBuffer, user);

			if (message) {
				this.yRedisClient.addMessage(user.room, 'index', message);
			}
		} catch (error) {
			console.error(error);
			ws.end(1011);
		}
	}

	private closeCallback(ws: WebSocket<YRedisUser>): void {
		try {
			const user = ws.getUserData();
			if (!user.room) return;

			if (user.awarenessId) {
				const awarenessMessage = this.yRedisService.createAwarenessUserDisconnectedMessage(user);
				this.yRedisClient.addMessage(user.room, 'index', awarenessMessage);
			}

			this.unsubscribeUser(user);

			MetricsService.openConnectionsGauge.dec();
		} catch (error) {
			console.error(error);
			// TODO: und jetzt wie räumen wir auf?
		}
	}

	private unsubscribeUser(user: YRedisUser): void {
		user.isClosed = true;
		user.subs.forEach((topic) => {
			if (this.webSocketServer.numSubscribers(topic) === 0) {
				this.subscriberService.unsubscribe(topic, this.redisMessageSubscriber);
			}
		});
	}
}
