import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-headerapikey/lib/Strategy.js';
import { StrategyType } from '../interface/index.js';
import { XApiKeyConfig } from '../x-api-key.config.js';

@Injectable()
export class XApiKeyStrategy extends PassportStrategy(Strategy, StrategyType.API_KEY) {
	public constructor(private readonly config: XApiKeyConfig) {
		super({ header: 'X-API-KEY', prefix: '' }, false);
	}

	public validate(apiKey: string): boolean {
		if (this.config.X_API_ALLOWED_KEYS.includes(apiKey)) {
			return true;
		}
		throw new UnauthorizedException();
	}
}
