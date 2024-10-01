import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigurationModule } from '../configuration/configuration.module.js';
import { XApiKeyConfig } from './config/x-api-key.config.js';
import { XApiKeyStrategy } from './strategy/index.js';

@Module({
	imports: [PassportModule, ConfigurationModule.register(XApiKeyConfig)],
	providers: [XApiKeyStrategy],
	exports: [],
})
export class AuthGuardModule {}
