import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// @ts-expect-error - @y/redis is only having jsdoc types
import { registerYWebsocketServer } from '@y/redis';
import { TemplatedApp } from 'uws';
import { AuthorizationService } from '../../../infra/authorization/authorization.service.js';
import { Logger } from '../../../infra/logging/logger.js';
import { MetricsService } from '../../../infra/metrics/metrics.service.js';
import { RedisService } from '../../../infra/redis/redis.service.js';
import { StorageService } from '../../../infra/storage/storage.service.js';

export const UWS = 'UWS';

@Injectable()
export class WebsocketGateway implements OnModuleInit, OnModuleDestroy {
	public constructor(
		@Inject(UWS) private webSocketServer: TemplatedApp,
		private storage: StorageService,
		private authorizationService: AuthorizationService,
		private redisService: RedisService,
		private configService: ConfigService,
		private logger: Logger,
	) {
		this.logger.setContext(WebsocketGateway.name);
	}

	public onModuleDestroy(): void {
		this.webSocketServer.close();
	}

	public async onModuleInit(): Promise<void> {
		const wsPathPrefix = this.configService.get<string>('WS_PATH_PREFIX') ?? '';
		const wsPort = Number(this.configService.get('WS_PORT', { infer: true })) ?? 3345;

		await registerYWebsocketServer(
			this.webSocketServer,
			`${wsPathPrefix}/:room`,
			await this.storage.get(),
			this.authorizationService.hasPermission.bind(this.authorizationService),
			{
				redisPrefix: this.configService.get<string>('REDIS_PREFIX') ?? 'y',
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
	}

	private incOpenConnectionsGauge(): void {
		MetricsService.openConnectionsGauge.inc();
	}

	private decOpenConnectionsGauge(): void {
		MetricsService.openConnectionsGauge.dec();
	}
}
