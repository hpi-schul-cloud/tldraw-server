import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TemplatedApp } from 'uws';
import { AuthorizationModule } from '../../infra/authorization/authorization.module.mjs';
import { RedisModule } from '../../infra/redis/index.mjs';
import { StorageModule } from '../../infra/storage/storage.module.mjs';
import { AppController } from './api/app.controller.mjs';
import { MetricsService } from './domain/metrics.service.mjs';
import { WebsocketService } from './domain/websocket.service.mjs';

@Module({
	imports: [ConfigModule.forRoot({isGlobal: true}), RedisModule, StorageModule, AuthorizationModule],
	controllers: [AppController],
	providers: [MetricsService, WebsocketService],
})
export class ServerModule {
	static register(uws: TemplatedApp): any {
		return {
			module: ServerModule,
			providers: [
				{
					provide: 'UWS',
					useValue: uws,
				},
			],
		};
	}
}
