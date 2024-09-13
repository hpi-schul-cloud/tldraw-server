import { Module } from '@nestjs/common';
import { LoggerModule } from '../logging/logger.module.js';
import { AuthorizationService } from './authorization.service.js';

@Module({
	imports: [LoggerModule],
	providers: [AuthorizationService],
	exports: [AuthorizationService],
})
export class AuthorizationModule {}
