import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service.js';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Test } from '@nestjs/testing';
import * as util from 'util';
import * as ioredisModule from 'ioredis';
import { Logger } from '../logging/logger.js';

const Redis = ioredisModule.Redis;

describe('Redis Service', () => {
	let service: RedisService;
	let configService: DeepMocked<ConfigService>;

	beforeAll(async () => {
		const moduleFixture = await Test.createTestingModule({
			providers: [
				RedisService,
				{
					provide: ConfigService,
					useValue: createMock<ConfigService>(),
				},
				{
					provide: Logger,
					useValue: createMock<Logger>(),
				},
			],
		}).compile();

		service = moduleFixture.get(RedisService);
		configService = moduleFixture.get(ConfigService);
	});

	beforeEach(() => {
		jest.resetAllMocks();
	});

	describe('createRedisInstance', () => {
		describe('when sentinelServiceName, sentinelName, sentinelPassword are set', () => {
			describe('when resolveSrv resolves', () => {
				const setup = () => {
					const sentinelServiceName = 'serviceName';
					const sentinelName = 'sentinelName';
					const sentinelPassword = 'sentinelPassword';

					configService.get.mockReturnValueOnce(sentinelServiceName);
					configService.get.mockReturnValueOnce(sentinelName);
					configService.get.mockReturnValueOnce(sentinelPassword);

					const name1 = 'name1';
					const name2 = 'name2';
					const port1 = '11';
					const port2 = '22';
					const records = [
						{ name: name1, port: port1 },
						{ name: name2, port: port2 },
					];
					const resolveSrv = jest.fn().mockResolvedValueOnce(records);
					jest.spyOn(util, 'promisify').mockReturnValueOnce(resolveSrv);

					//const redisMock = createMock<Redis>();
					//jest.spyOn(ioredisModule, 'Redis').mockReturnValueOnce(redisMock);

					return { resolveSrv, sentinelServiceName };
				};

				it('calls resolveSrv', async () => {
					const { resolveSrv, sentinelServiceName } = setup();

					await service.createRedisInstance();

					expect(resolveSrv).toHaveBeenLastCalledWith(sentinelServiceName);
				});
			});
		});
	});
});
