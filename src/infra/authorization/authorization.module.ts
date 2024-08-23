import { Module } from '@nestjs/common';
import { AuthorizationService } from './authorization.service.js';

@Module({
	providers: [AuthorizationService],
	exports: [AuthorizationService],
})
export class AuthorizationModule {}