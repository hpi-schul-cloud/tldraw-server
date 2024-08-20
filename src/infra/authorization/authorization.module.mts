import { Module } from '@nestjs/common';
import { AuthorizationService } from './authorization.service.mjs';

@Module({
    providers: [AuthorizationService],
    exports: [AuthorizationService],
})
export class AuthorizationModule {}
