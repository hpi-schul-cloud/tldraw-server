import { Module } from '@nestjs/common';
import { LoggerModule } from '../logging/logger.module.js';
import { AuthorizationApi } from './authorization-api-client/index.js';
import { AuthorizationService } from './authorization.service.js';

@Module({
	imports: [LoggerModule],
	providers: [AuthorizationApi, AuthorizationService],
	exports: [AuthorizationService],
})
export class AuthorizationModule {}
