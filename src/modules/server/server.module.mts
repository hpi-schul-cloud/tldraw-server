import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { App } from 'uws';
import { AuthorizationModule } from '../../infra/authorization/authorization.module.mjs';
import { LoggerModule } from '../../infra/logging/logger.module.mjs';
import { RedisModule } from '../../infra/redis/index.mjs';
import { StorageModule } from '../../infra/storage/storage.module.mjs';
import { AppController } from './api/app.controller.mjs';
import { UWS, WebsocketGateway } from './api/websocket.gateway.mjs';
import { MetricsService } from './domain/metrics.service.mjs';

@Module({
	imports: [ConfigModule.forRoot({ isGlobal: true }), RedisModule, StorageModule, AuthorizationModule, LoggerModule],
	controllers: [AppController],
	providers: [
		MetricsService,
		WebsocketGateway,
		{
			provide: UWS,
			useValue: App({}),
		},
	],
})
export class ServerModule {}
