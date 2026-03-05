import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../configuration/configuration.module.js';
import { LoggerModule } from '../logger/logger.module.js';
import { AuthorizationApi, Configuration } from './authorization-api-client/index.js';
import { AUTHORIZATION_CONFIG, AuthorizationConfig } from './authorization.config.js';
import { AuthorizationService } from './authorization.service.js';

@Module({
	imports: [LoggerModule, ConfigurationModule.register(AUTHORIZATION_CONFIG, AuthorizationConfig)],
	providers: [
		{
			provide: AuthorizationApi,
			useFactory: (config: AuthorizationConfig): AuthorizationApi => {
				const apiHost = config.authorizationApiHost;
				const configuration = new Configuration({ basePath: `${apiHost}/api/v3` });
				const authorizationApi = new AuthorizationApi(configuration);

				return authorizationApi;
			},
			inject: [AUTHORIZATION_CONFIG],
		},
		AuthorizationService,
	],
	exports: [AuthorizationService],
})
export class AuthorizationModule {}
