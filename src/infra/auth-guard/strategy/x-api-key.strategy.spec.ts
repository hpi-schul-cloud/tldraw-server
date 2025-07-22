import { createMock } from '@golevelup/ts-jest';
import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { XApiKeyConfig } from '../x-api-key.config.js';
import { XApiKeyStrategy } from './x-api-key.strategy.js';

describe('XApiKeyStrategy', () => {
	let module: TestingModule;
	let strategy: XApiKeyStrategy;
	let config: XApiKeyConfig;

	beforeAll(async () => {
		module = await Test.createTestingModule({
			imports: [],
			providers: [
				XApiKeyStrategy,
				{
					provide: XApiKeyConfig,
					useValue: createMock<XApiKeyConfig>(),
				},
			],
		}).compile();

		strategy = module.get(XApiKeyStrategy);
		config = module.get(XApiKeyConfig);
	});

	afterAll(async () => {
		await module.close();
	});

	beforeEach(() => {
		jest.resetAllMocks();
	});

	describe('validate', () => {
		describe('when a valid api key is provided', () => {
			it('should return true', () => {
				const CORRECT_API_KEY = '7ccd4e11-c6f6-48b0-81eb-cccf7922e7a4';
				config.X_API_ALLOWED_KEYS = [CORRECT_API_KEY];

				expect(strategy.validate(CORRECT_API_KEY)).toBe(true);
			});
		});

		describe('when an invalid api key is provided', () => {
			it('should throw an UnauthorizedException', () => {
				const INVALID_API_KEY = '7ccd4e11-c6f6-48b0-81eb-cccf7922e7a4BAD';
				config.X_API_ALLOWED_KEYS = ['some-other-key'];

				expect(() => strategy.validate(INVALID_API_KEY)).toThrow(UnauthorizedException);
			});
		});

		describe('when no api keys are allowed', () => {
			it('should throw an UnauthorizedException', () => {
				const ANY_API_KEY = '7ccd4e11-c6f6-48b0-81eb-cccf7922e7a4';
				config.X_API_ALLOWED_KEYS = [];

				expect(() => strategy.validate(ANY_API_KEY)).toThrow(UnauthorizedException);
			});
		});
	});

	describe('constructor', () => {
		it('should create strategy', () => {
			const ApiKeyStrategy = new XApiKeyStrategy(config);

			expect(ApiKeyStrategy).toBeDefined();
			expect(ApiKeyStrategy).toBeInstanceOf(XApiKeyStrategy);
		});
	});
});
