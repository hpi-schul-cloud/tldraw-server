import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from '../logging/logger.module.js';
import { AuthorizationApi, Configuration } from './authorization-api-client/index.js';
import { AuthorizationService } from './authorization.service.js';

@Module({
	imports: [LoggerModule],
	providers: [
		{
			provide: AuthorizationApi,
			useFactory: (configService: ConfigService): AuthorizationApi => {
				const apiHost = configService.getOrThrow<string>('API_HOST');
				const configuration = new Configuration({ basePath: apiHost });
				const authorizationApi = new AuthorizationApi(configuration);

				return authorizationApi;
			},
			inject: [ConfigService],
		},
		AuthorizationService,
	],
	exports: [AuthorizationService],
})
export class AuthorizationModule {}
