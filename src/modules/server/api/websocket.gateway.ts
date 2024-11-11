import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { TemplatedApp } from 'uWebSockets.js';
import { AuthorizationService } from '../../../infra/authorization/authorization.service.js';
import { Logger } from '../../../infra/logger/index.js';
import { MetricsService } from '../../../infra/metrics/metrics.service.js';
import { RedisService } from '../../../infra/redis/redis.service.js';
import { StorageService } from '../../../infra/storage/storage.service.js';
import { registerYWebsocketServer } from '../../../infra/y-redis/ws.service.js';
import { ServerConfig } from '../server.config.js';

export const UWS = 'UWS';

@Injectable()
export class WebsocketGateway implements OnModuleInit, OnModuleDestroy {
	public constructor(
		@Inject(UWS) private readonly webSocketServer: TemplatedApp,
		private readonly storageService: StorageService,
		private readonly authorizationService: AuthorizationService,
		private readonly redisService: RedisService,
		private readonly config: ServerConfig,
		private readonly logger: Logger,
	) {
		this.logger.setContext(WebsocketGateway.name);
	}

	public onModuleDestroy(): void {
		this.webSocketServer.close();
	}

	public async onModuleInit(): Promise<void> {
		const wsPathPrefix = this.config.WS_PATH_PREFIX;
		const wsPort = this.config.WS_PORT;

		await registerYWebsocketServer(
			this.webSocketServer,
			`${wsPathPrefix}/:room`,
			this.storageService,
			this.authorizationService.hasPermission.bind(this.authorizationService),
			{
				openWsCallback: () => MetricsService.openConnectionsGauge.inc(),
				closeWsCallback: () => MetricsService.openConnectionsGauge.dec(),
			},
			this.redisService,
		);

		this.webSocketServer.listen(wsPort, (t) => {
			if (t) {
				this.logger.log(`Websocket Server is running on port ${wsPort}`);
			}
		});

		const redisAdapter = await this.redisService.createRedisInstance();
		redisAdapter.subscribeToDeleteChannel((message: string) => {
			this.webSocketServer.publish(message, 'action:delete');
		});
	}
}
