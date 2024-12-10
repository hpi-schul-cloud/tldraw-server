import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
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
import { YRedisDoc } from '../../../infra/y-redis/interfaces/y-redis-doc.js';
import { Subscriber } from '../../../infra/y-redis/subscriber.service.js';
import { YRedisUserFactory } from '../../../infra/y-redis/y-redis-user.factory.js';
import { YRedisUser } from '../../../infra/y-redis/y-redis-user.js';
import { YRedisClient } from '../../../infra/y-redis/y-redis.client.js';
import { YRedisService } from '../../../infra/y-redis/y-redis.service.js';
import { REDIS_FOR_SUBSCRIBE_OF_DELETION, UWS } from '../server.const.js';
import { TldrawServerConfig } from '../tldraw-server.config.js';

interface RequestHeaderInfos {
	headerWsExtensions: string;
	headerWsKey: string;
	headerWsProtocol: string;
}

// https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent/code
enum WebSocketErrorCodes {
	InternalError = 1011,
	PolicyViolation = 1008,
	TldrawPolicyViolation = 4401,
	TldrawInternalError = 4500,
}

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
		this.subscriberService.start();

		this.webSocketServer.ws(`${this.config.TLDRAW_WEBSOCKET_PATH}/:room`, {
			compression: SHARED_COMPRESSOR,
			maxPayloadLength: 100 * 1024 * 1024,
			idleTimeout: 60,
			sendPingsAutomatically: true,
			upgrade: (res, req, context) => this.upgradeCallback(res, req, context),
			open: (ws: WebSocket<YRedisUser>) => this.openCallback(ws),
			message: (ws, messageBuffer) => this.messageCallback(ws, messageBuffer),
			close: (ws) => this.closeCallback(ws),
		});

		this.webSocketServer.listen(this.config.TLDRAW_WEBSOCKET_PORT, (t) => {
			if (t) {
				this.logger.log(`Websocket Server is running on port ${this.config.TLDRAW_WEBSOCKET_PORT}`);
			}
		});

		this.redisAdapter.subscribeToDeleteChannel((message: string) => {
			this.webSocketServer.publish(message, 'action:delete');
		});
	}

	private async upgradeCallback(res: HttpResponse, req: HttpRequest, context: us_socket_context_t): Promise<void> {
		try {
			let aborted = false;
			const { headerWsKey, headerWsProtocol, headerWsExtensions } = this.extractHeaderInfos(req);

			res.onAborted(() => {
				aborted = true;
			});

			// TODO: Das throwed nicht ! Was macht das aborted?
			const authPayload = await this.authorizationService.hasPermission(req);
			if (aborted) return;

			res.cork(() => {
				const yRedisUser = YRedisUserFactory.build(authPayload);
				res.upgrade(yRedisUser, headerWsKey, headerWsProtocol, headerWsExtensions, context);
			});
		} catch (error) {
			res.cork(() => {
				res.writeStatus('500 Internal Server Error').end('Internal Server Error');
			});
			this.logger.warning(error); // TODO: this.logger.error nur das interface erlaubt es gerade nicht
		}
	}

	private extractHeaderInfos(req: HttpRequest): RequestHeaderInfos {
		const headerWsKey = req.getHeader('sec-websocket-key');
		const headerWsProtocol = req.getHeader('sec-websocket-protocol');
		const headerWsExtensions = req.getHeader('sec-websocket-extensions');

		return {
			headerWsExtensions,
			headerWsKey,
			headerWsProtocol,
		};
	}

	private async openCallback(ws: WebSocket<YRedisUser>): Promise<void> {
		try {
			const user = ws.getUserData();
			if (user.error != null) {
				const { code: authorizationRequestErrorCode, reason } = user.error;
				this.logger.warning(`Error: ${authorizationRequestErrorCode} - ${reason}`);
				ws.end(authorizationRequestErrorCode, reason);

				return;
			}

			if (user.room === null || user.userid === null) {
				ws.end(WebSocketErrorCodes.PolicyViolation);

				return;
			}

			MetricsService.openConnectionsGauge.inc();

			const stream = computeRedisRoomStreamName(user.room, 'index', this.yRedisClient.redisPrefix);
			user.subs.add(stream);
			ws.subscribe(stream);

			const { redisId } = this.subscriberService.subscribe(stream, this.redisMessageSubscriber);
			user.initialRedisSubId = redisId;

			const yRedisDoc = await this.yRedisClient.getDoc(user.room, 'index');

			if (user.isClosed) return;

			ws.cork(() => {
				ws.send(this.yRedisService.encodeSyncStep1StateVectorMessage(yRedisDoc.ydoc), true, false);
				ws.send(this.yRedisService.encodeSyncStep2StateAsUpdateMessage(yRedisDoc.ydoc), true, true);
				if (yRedisDoc.getAwarenessStateSize() > 0) {
					ws.send(this.yRedisService.encodeAwarenessUpdateMessage(yRedisDoc.awareness), true, true);
				}
			});

			this.destroyAwarenessToAvoidMemoryLeak(yRedisDoc);

			if (isSmallerRedisId(yRedisDoc.redisLastId, user.initialRedisSubId)) {
				// our subscription is newer than the content that we received from the api
				// need to renew subscription id and make sure that we catch the latest content.
				this.subscriberService.ensureSubId(stream, yRedisDoc.redisLastId);
			}
		} catch (error) {
			this.logger.warning(error);
			ws.end(WebSocketErrorCodes.InternalError);
		}
	}

	private destroyAwarenessToAvoidMemoryLeak(indexDoc: YRedisDoc): void {
		// awareness is destroyed here to avoid memory leaks, see: https://github.com/yjs/y-redis/issues/24
		indexDoc.awareness.destroy();
	}

	private readonly redisMessageSubscriber = (stream: string, messages: Uint8Array[]): void => {
		if (!this.isSubscriberAvailable(stream)) {
			this.subscriberService.unsubscribe(stream, this.redisMessageSubscriber);
		}

		const message = this.yRedisService.mergeMessagesToMessage(messages);
		this.webSocketServer.publish(stream, message, true, false);
	};

	private isSubscriberAvailable(stream: string): boolean {
		return this.webSocketServer.numSubscribers(stream) > 0;
	}

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
			this.logger.warning(error);
			ws.end(WebSocketErrorCodes.InternalError);
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
			this.logger.warning(error);
			ws.end(WebSocketErrorCodes.InternalError);
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
