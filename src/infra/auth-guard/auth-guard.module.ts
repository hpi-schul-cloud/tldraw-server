import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigurationModule } from '../configuration/configuration.module.js';
import { XApiKeyStrategy } from './strategy/index.js';
import { X_API_KEY_CONFIG, XApiKeyConfig } from './x-api-key.config.js';

@Module({
	imports: [PassportModule, ConfigurationModule.register(X_API_KEY_CONFIG, XApiKeyConfig)],
	providers: [XApiKeyStrategy],
	exports: [],
})
export class AuthGuardModule {}
