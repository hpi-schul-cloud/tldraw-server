import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-headerapikey/lib/Strategy.js';
import { StrategyType } from '../interface/index.js';
import { X_API_KEY_CONFIG, XApiKeyConfig } from '../x-api-key.config.js';

@Injectable()
export class XApiKeyStrategy extends PassportStrategy(Strategy, StrategyType.API_KEY) {
	public constructor(@Inject(X_API_KEY_CONFIG) private readonly config: XApiKeyConfig) {
		super({ header: 'X-API-KEY', prefix: '' }, false);
	}

	public validate(apiKey: string): boolean {
		if (this.config.xApiAllowedKeys.includes(apiKey)) {
			return true;
		}
		throw new UnauthorizedException();
	}
}
