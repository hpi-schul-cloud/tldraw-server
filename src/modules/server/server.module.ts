import { Module, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { App } from 'uWebSockets.js';
import { AuthGuardModule } from '../../infra/auth-guard/auth-guard.module.js';
import { AuthorizationModule } from '../../infra/authorization/authorization.module.js';
import { ConfigurationModule } from '../../infra/configuration/configuration.module.js';
import { LoggerModule } from '../../infra/logger/logger.module.js';
import { RedisModule } from '../../infra/redis/index.js';
import { StorageModule } from '../../infra/storage/storage.module.js';
import { TldrawConfigController } from './api/tldraw-confg.controller.js';
import { TldrawDocumentController } from './api/tldraw-document.controller.js';
import { UWS, WebsocketGateway } from './api/websocket.gateway.js';
import { ServerConfig } from './server.config.js';
import { TldrawDocumentService } from './service/tldraw-document.service.js';

export const moduleImports = [
	ConfigurationModule.register(ServerConfig),
	RedisModule,
	StorageModule,
	AuthorizationModule,
	LoggerModule,
	AuthGuardModule,
];
export const moduleProviders = [
	WebsocketGateway,
	TldrawDocumentService,
	{
		provide: UWS,
		useValue: App({}),
	},
	{
		provide: APP_PIPE,
		useValue: new ValidationPipe({
			// enable DTO instance creation for incoming data
			transform: true,
			transformOptions: {
				// enable type coersion, requires transform:true
				enableImplicitConversion: true,
			},
			whitelist: true, // only pass valid @ApiProperty-decorated DTO properties, remove others
			forbidNonWhitelisted: false, // additional params are just skipped (required when extracting multiple DTO from single query)
			forbidUnknownValues: true,
			validationError: {
				// make sure target (DTO) is set on validation error
				// we need this to be able to get DTO metadata for checking if a value has to be the obfuscated on output
				// see e.g. ErrorLoggable
				target: true,
				value: true,
			},
		}),
	},
];
export const moduleControllers = [TldrawDocumentController, TldrawConfigController];

@Module({
	imports: moduleImports,
	providers: moduleProviders,
	controllers: moduleControllers,
})
export class ServerModule {}
