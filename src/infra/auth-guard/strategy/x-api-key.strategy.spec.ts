import { createMock } from '@golevelup/ts-jest';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { XApiKeyConfig } from '../config/x-api-key.config.js';
import { XApiKeyStrategy } from './x-api-key.strategy.js';

describe('XApiKeyStrategy', () => {
	let module: TestingModule;
	let strategy: XApiKeyStrategy;
	let configService: ConfigService<XApiKeyConfig, true>;

	beforeAll(async () => {
		module = await Test.createTestingModule({
			imports: [],
			providers: [
				XApiKeyStrategy,
				{
					provide: ConfigService,
					useValue: createMock<ConfigService<XApiKeyConfig, true>>({
						get: () => ['7ccd4e11-c6f6-48b0-81eb-cccf7922e7a4'],
					}),
				},
			],
		}).compile();

		strategy = module.get(XApiKeyStrategy);
		configService = module.get(ConfigService<XApiKeyConfig, true>);
	});

	afterAll(async () => {
		await module.close();
	});

	beforeEach(() => {
		jest.resetAllMocks();
	});

	describe('validate', () => {
		const done = jest.fn(() => null);
		describe('when a valid api key is provided', () => {
			const setup = () => {
				const CORRECT_API_KEY = '7ccd4e11-c6f6-48b0-81eb-cccf7922e7a4';

				return { CORRECT_API_KEY, done };
			};
			it('should do nothing', () => {
				const { CORRECT_API_KEY } = setup();
				strategy.validate(CORRECT_API_KEY, done);
				expect(done).toBeCalledWith(null, true);
			});
		});

		describe('when a invalid api key is provided', () => {
			const setup = () => {
				const INVALID_API_KEY = '7ccd4e11-c6f6-48b0-81eb-cccf7922e7a4BAD';

				return { INVALID_API_KEY, done };
			};
			it('should throw error', () => {
				const { INVALID_API_KEY } = setup();
				strategy.validate(INVALID_API_KEY, done);
				expect(done).toBeCalledWith(new UnauthorizedException(), null);
			});
		});
	});

	describe('constructor', () => {
		it('should create strategy', () => {
			const ApiKeyStrategy = new XApiKeyStrategy(configService);
			expect(ApiKeyStrategy).toBeDefined();
			expect(ApiKeyStrategy).toBeInstanceOf(XApiKeyStrategy);
		});
	});
});
