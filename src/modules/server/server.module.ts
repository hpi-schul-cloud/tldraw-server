import { Module, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { App } from 'uWebSockets.js';
import { AuthGuardModule } from '../../infra/auth-guard/index.js';
import { AuthorizationModule } from '../../infra/authorization/index.js';
import { ConfigurationModule } from '../../infra/configuration/index.js';
import { LoggerModule } from '../../infra/logger/index.js';
import { RedisModule } from '../../infra/redis/index.js';
import { StorageModule } from '../../infra/storage/index.js';
import { YRedisClientModule, YRedisServiceModule } from '../../infra/y-redis/index.js';
import { TldrawConfigController } from './api/tldraw-confg.controller.js';
import { TldrawDocumentController } from './api/tldraw-document.controller.js';
import { WebsocketGateway } from './api/websocket.gateway.js';
import { REDIS_FOR_DELETION, REDIS_FOR_SUBSCRIBE_OF_DELETION, UWS } from './server.const.js';
import { TldrawDocumentService } from './service/tldraw-document.service.js';
import { TldrawServerConfig } from './tldraw-server.config.js';

@Module({
	imports: [
		ConfigurationModule.register(TldrawServerConfig),
		YRedisClientModule.register(),
		YRedisServiceModule.register(),
		RedisModule.registerFor(REDIS_FOR_DELETION),
		RedisModule.registerFor(REDIS_FOR_SUBSCRIBE_OF_DELETION),
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
	],
	controllers: [TldrawDocumentController, TldrawConfigController],
})
export class ServerModule {}
