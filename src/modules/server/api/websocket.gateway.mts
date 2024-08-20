import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { registerYWebsocketServer } from '@y/redis';
import { Gauge } from 'prom-client';
import { TemplatedApp } from 'uws';
import { AuthorizationService } from '../../../infra/authorization/authorization.service.mjs';
import { Logger } from '../../../infra/logging/logger.mjs';
import { RedisService } from '../../../infra/redis/redis.service.mjs';
import { StorageService } from '../../../infra/storage/storage.service.mjs';

export const UWS = 'UWS';

@Injectable()
export class WebsocketGateway implements OnModuleInit, OnModuleDestroy {
	private openConnectionsGauge = new Gauge({
		name: 'tldraw_open_connections',
		help: 'Number of open WebSocket connections on tldraw-server.',
	});

	constructor(
		@Inject(UWS) private webSocketServer: TemplatedApp,
		private storage: StorageService,
		private authorizationService: AuthorizationService,
		private redisService: RedisService,
		private configService: ConfigService,
		private logger: Logger,
	) {
		this.logger.setContext(WebsocketGateway.name);
	}

	onModuleDestroy() {
		this.webSocketServer.close();
	}

	async onModuleInit() {
		const wsPath = this.configService.get<string>('WS_PATH_PREFIX');
		const wsPort = this.configService.get<number>('WS_PORT') || 3345;

		this.webSocketServer.listen(wsPort, (t) => {
			if (t) {
			  this.logger.log(`Websocket Server is running on port ${wsPort}`);
			}
		  });

		await registerYWebsocketServer(
			this.webSocketServer,
			wsPath,
			await this.storage.get(),
			this.authorizationService.hasPermission.bind(this.authorizationService),
			{
				redisPrefix: this.configService.get<string>('REDIS_PREFIX') || 'y',
				openWsCallback: () => this.incOpenConnectionsGauge(),
				closeWsCallback: () => this.decOpenConnectionsGauge(),
			},
			await this.redisService.getRedisInstance(),
		);
	}

	private incOpenConnectionsGauge() {
		this.openConnectionsGauge.inc();
	}

	private decOpenConnectionsGauge() {
		this.openConnectionsGauge.dec();
	}
}