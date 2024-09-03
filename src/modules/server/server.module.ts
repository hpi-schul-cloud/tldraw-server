import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { App } from 'uws';
import { AuthorizationModule } from '../../infra/authorization/authorization.module.js';
import { LoggerModule } from '../../infra/logging/logger.module.js';
import { RedisModule } from '../../infra/redis/index.js';
import { StorageModule } from '../../infra/storage/storage.module.js';
import { UWS, WebsocketGateway } from './api/websocket.gateway.js';
import { AuthGuardModule } from '../../infra/auth-guard/auth-guard.module.js';
import { TldrawDocumentController } from './api/tldraw-document.controller.js';

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		RedisModule,
		StorageModule,
		AuthorizationModule,
		LoggerModule,
		AuthGuardModule,
	],
	providers: [
		WebsocketGateway,
		{
			provide: UWS,
			useValue: App({}),
		},
	],
	controllers: [TldrawDocumentController],
})
export class ServerModule {}
