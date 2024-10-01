import { createMock } from '@golevelup/ts-jest';
import { Redis } from 'ioredis';
import * as util from 'util';
import { Logger } from '../logging/logger.js';
import { RedisConfig } from './redis.config.js';
import { RedisService } from './redis.service.js';

jest.mock('ioredis', () => {
	return {
		Redis: jest.fn(),
	};
});

describe('Redis Service', () => {
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
					const redisPrefix = 'A';

					const config = new RedisConfig();

					config.REDIS = sentinelServiceName;
					config.REDIS_SENTINEL_SERVICE_NAME = sentinelServiceName;
					config.REDIS_PREFIX = redisPrefix;
					config.REDIS_SENTINEL_NAME = sentinelName;
					config.REDIS_SENTINEL_PASSWORD = sentinelPassword;

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
					const logger = createMock<Logger>();
					const service = new RedisService(config, logger);

					return { resolveSrv, sentinelServiceName, service };
				};

				it('calls resolveSrv', async () => {
					const { resolveSrv, sentinelServiceName, service } = setup();

					await service.createRedisInstance();

					expect(resolveSrv).toHaveBeenLastCalledWith(sentinelServiceName);
				});

				it('creates a new Redis instance', async () => {
					const { service } = setup();

					const redisInstance = await service.createRedisInstance();

					expect(redisInstance).toBeInstanceOf(Redis);
				});
			});
		});
	});
});
