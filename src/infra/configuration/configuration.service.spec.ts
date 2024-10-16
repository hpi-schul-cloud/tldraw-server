import { createMock } from '@golevelup/ts-jest';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { IsString } from 'class-validator';
import { Configuration } from './configuration.service.js';

class TestConfig {
	@IsString()
	public TEST_VALUE!: string;
}

describe(Configuration.name, () => {
	let module: TestingModule;
	let service: Configuration;
	let configService: ConfigService;

	beforeAll(async () => {
		module = await Test.createTestingModule({
			providers: [
				Configuration,
				{
					provide: ConfigService,
					useValue: createMock<ConfigService>(),
				},
			],
		}).compile();

		service = module.get<Configuration>(Configuration);
		configService = module.get<ConfigService>(ConfigService);
	});

	afterAll(async () => {
		await module.close();
	});

	afterEach(() => {
		jest.resetAllMocks();
	});

	describe('getAllValidConfigsByType', () => {
		describe('when value is valid', () => {
			it('should return valid configs', () => {
				jest.spyOn(configService, 'get').mockReturnValueOnce('test');

				const result = service.getAllValidConfigsByType(TestConfig);

				expect(result).toEqual({ TEST_VALUE: 'test' });
			});
		});

		describe('when value is not valid', () => {
			it('should throw error', () => {
				jest.spyOn(configService, 'get').mockReturnValueOnce(123);

				expect(() => service.getAllValidConfigsByType(TestConfig)).toThrow(/isString/);
			});
		});
	});
});
