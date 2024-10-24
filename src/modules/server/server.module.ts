import { Module } from '@nestjs/common';
import { App } from 'uws';
import { AuthGuardModule } from '../../infra/auth-guard/auth-guard.module.js';
import { AuthorizationModule } from '../../infra/authorization/authorization.module.js';
import { ConfigurationModule } from '../../infra/configuration/configuration.module.js';
import { LoggerModule } from '../../infra/logging/logger.module.js';
import { RedisModule } from '../../infra/redis/index.js';
import { StorageModule } from '../../infra/storage/storage.module.js';
import { TldrawConfigController } from './api/tldraw-confg.controller.js';
import { TldrawDocumentController } from './api/tldraw-document.controller.js';
import { UWS, WebsocketGateway } from './api/websocket.gateway.js';
import { ServerConfig } from './server.config.js';
import { TldrawDocumentService } from './service/tldraw-document.service.js';

@Module({
	imports: [
		ConfigurationModule.register(ServerConfig),
		RedisModule,
		StorageModule,
		AuthorizationModule,
		LoggerModule,
		AuthGuardModule,
	],
	providers: [
		WebsocketGateway,
		TldrawDocumentService,
		{
			provide: UWS,
			useValue: App({}),
		},
	],
	controllers: [TldrawDocumentController, TldrawConfigController],
})
export class ServerModule {}
