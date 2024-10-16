import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../configuration/configuration.module.js';
import { LoggerModule } from '../logging/logger.module.js';
import { AuthorizationApi, Configuration } from './authorization-api-client/index.js';
import { AuthorizationConfig } from './authorization.config.js';
import { AuthorizationService } from './authorization.service.js';

@Module({
	imports: [LoggerModule, ConfigurationModule.register(AuthorizationConfig)],
	providers: [
		{
			provide: AuthorizationApi,
			useFactory: (config: AuthorizationConfig): AuthorizationApi => {
				const apiHost = config.API_HOST;
				const configuration = new Configuration({ basePath: `${apiHost}/api/v3` });
				const authorizationApi = new AuthorizationApi(configuration);

				return authorizationApi;
			},
			inject: [AuthorizationConfig],
		},
		AuthorizationService,
	],
	exports: [AuthorizationService],
})
export class AuthorizationModule {}
