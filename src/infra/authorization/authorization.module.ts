import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../configuration/configuration.module.js';
import { LoggerModule } from '../logging/logger.module.js';
import { AuthorizationConfig } from './authorization.config.js';
import { AuthorizationService } from './authorization.service.js';

@Module({
	imports: [LoggerModule, ConfigurationModule.register(AuthorizationConfig)],
	providers: [AuthorizationService],
	exports: [AuthorizationService],
})
export class AuthorizationModule {}
