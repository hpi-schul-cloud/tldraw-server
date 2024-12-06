import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { encoding } from 'lib0';
import { SHARED_COMPRESSOR, TemplatedApp, WebSocket } from 'uWebSockets.js';
import { AuthorizationService } from '../../../infra/authorization/authorization.service.js';
import { Logger } from '../../../infra/logger/index.js';
import { MetricsService } from '../../../infra/metrics/metrics.service.js';
import { RedisAdapter } from '../../../infra/redis/interfaces/redis-adapter.js';
import { Api } from '../../../infra/y-redis/api.service.js';
import { Subscriber } from '../../../infra/y-redis/subscriber.service.js';
import {
	closeCallback,
	messageCallback,
	openCallback,
	upgradeCallback,
	User,
} from '../../../infra/y-redis/ws.service.js';
import { REDIS_FOR_SUBSCRIBE_OF_DELETION, UWS } from '../server.const.js';
import { TldrawServerConfig } from '../tldraw-server.config.js';

@Injectable()
export class WebsocketGateway implements OnModuleInit, OnModuleDestroy {
	public constructor(
		@Inject(UWS) private readonly webSocketServer: TemplatedApp,
		private readonly subscriberService: Subscriber,
		private readonly client: Api,
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
		const checkAuth = this.authorizationService.hasPermission.bind(this.authorizationService);
		this.subscriberService.start();

		this.webSocketServer.ws(`${wsPathPrefix}/:room`, {
			compression: SHARED_COMPRESSOR,
			maxPayloadLength: 100 * 1024 * 1024,
			idleTimeout: 60,
			sendPingsAutomatically: true,
			upgrade: (res, req, context) => upgradeCallback(res, req, context, checkAuth),
			open: (ws: WebSocket<User>) =>
				openCallback(ws, this.subscriberService, this.client, this.redisMessageSubscriber, () =>
					MetricsService.openConnectionsGauge.inc(),
				),
			message: (ws, messageBuffer) => messageCallback(ws, messageBuffer, this.client),
			close: (ws, code, message) =>
				closeCallback(
					this.webSocketServer,
					ws,
					this.client,
					this.subscriberService,
					code,
					message,
					this.redisMessageSubscriber,
					() => MetricsService.openConnectionsGauge.dec(),
				),
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
}
