import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { XApiKeyStrategy } from './strategy/index.js';

@Module({
	imports: [PassportModule],
	providers: [XApiKeyStrategy],
	exports: [],
})
export class AuthGuardModule {}
