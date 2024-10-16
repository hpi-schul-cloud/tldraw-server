import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-headerapikey/lib/Strategy.js';
import { StrategyType } from '../interface/index.js';
import { XApiKeyConfig } from '../x-api-key.config.js';

@Injectable()
export class XApiKeyStrategy extends PassportStrategy(Strategy, StrategyType.API_KEY) {
	private readonly allowedApiKeys: string[];

	public constructor(private readonly config: XApiKeyConfig) {
		super({ header: 'X-API-KEY' }, false);
		this.allowedApiKeys = this.config.ADMIN_API__ALLOWED_API_KEYS;
	}

	public validate(apiKey: string, done: (error: Error | null, data: boolean | null) => void): void {
		if (this.allowedApiKeys.includes(apiKey)) {
			done(null, true);
		}
		done(new UnauthorizedException(), null);
	}
}
