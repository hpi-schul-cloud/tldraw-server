import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
// @ts-expect-error - @y/redis is only having jsdoc types
import { registerYWebsocketServer } from '@y/redis';
import { TemplatedApp } from 'uws';
import { AuthorizationService } from '../../../infra/authorization/authorization.service.js';
import { Logger } from '../../../infra/logger/index.js';
import { MetricsService } from '../../../infra/metrics/metrics.service.js';
import { RedisService } from '../../../infra/redis/redis.service.js';
import { StorageService } from '../../../infra/storage/storage.service.js';
import { ServerConfig } from '../server.config.js';

export const UWS = 'UWS';

@Injectable()
export class WebsocketGateway implements OnModuleInit, OnModuleDestroy {
	public constructor(
		@Inject(UWS) private readonly webSocketServer: TemplatedApp,
		private readonly storage: StorageService,
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
			await this.storage.get(),
			this.authorizationService.hasPermission.bind(this.authorizationService),
			{
				redisPrefix: this.config.REDIS_PREFIX,
				openWsCallback: () => this.incOpenConnectionsGauge(),
				closeWsCallback: () => this.decOpenConnectionsGauge(),
			},
			this.redisService.createRedisInstance.bind(this.redisService),
		);

		this.webSocketServer.listen(wsPort, (t) => {
			if (t) {
				this.logger.log(`Websocket Server is running on port ${wsPort}`);
			}
		});

		this.redisService.subscribeToDeleteChannel((message: string) => {
			this.webSocketServer.publish(message, 'action:delete');
		});
	}

	private incOpenConnectionsGauge(): void {
		MetricsService.openConnectionsGauge.inc();
	}

	private decOpenConnectionsGauge(): void {
		MetricsService.openConnectionsGauge.dec();
	}
}
