import { createMock } from '@golevelup/ts-jest';
import { Redis } from 'ioredis';
import * as util from 'util';
import { Logger } from '../logging/logger.js';
import { IoRedisAdapter } from './ioredis.adapter.js';
import { RedisConfig } from './redis.config.js';
import { RedisService } from './redis.service.js';

jest.mock('ioredis', () => {
	return {
		Redis: jest.fn(),
	};
});

jest.mock<IoRedisAdapter>('./ioredis.adapter.js');

describe('Redis Service', () => {
	beforeEach(() => {
		jest.resetAllMocks();
	});

	describe('createRedisInstance', () => {
		describe('when REDIS_CLUSTER_ENABLED is true', () => {
			const setup = () => {
				const sentinelServiceName = 'serviceName';
				const sentinelName = 'sentinelName';
				const sentinelPassword = 'sentinelPassword';
				const redisPrefix = 'A';

				const config = new RedisConfig();

				config.REDIS = sentinelServiceName;
				config.REDIS_CLUSTER_ENABLED = true;
				config.REDIS_SENTINEL_SERVICE_NAME = sentinelServiceName;
				config.REDIS_PREFIX = redisPrefix;
				config.REDIS_SENTINEL_NAME = sentinelName;
				config.REDIS_SENTINEL_PASSWORD = sentinelPassword;

				const name1 = 'name1';
				const name2 = 'name2';
				const port1 = 11;
				const port2 = 22;
				const records = [
					{ name: name1, port: port1 },
					{ name: name2, port: port2 },
				];
				const resolveSrv = jest.fn().mockResolvedValueOnce(records);
				jest.spyOn(util, 'promisify').mockReturnValueOnce(resolveSrv);
				// @ts-ignore
				const constructorSpy = jest.spyOn(Redis.prototype, 'constructor');

				const logger = createMock<Logger>();
				const service = new RedisService(config, logger);

				const expectedProps = {
					sentinels: [
						{ host: name1, port: port1 },
						{ host: name2, port: port2 },
					],
					sentinelPassword: 'sentinelPassword',
					password: 'sentinelPassword',
					name: 'sentinelName',
				};

				return { resolveSrv, sentinelServiceName, service, constructorSpy, expectedProps };
			};

			it('calls resolveSrv', async () => {
				const { resolveSrv, sentinelServiceName, service } = setup();

				await service.createRedisInstance();

				expect(resolveSrv).toHaveBeenLastCalledWith(sentinelServiceName);
			});

			it('create new Redis instance with correctly props', async () => {
				const { service, constructorSpy, expectedProps } = setup();

				await service.createRedisInstance();

				expect(constructorSpy).toHaveBeenCalledWith(expectedProps);
			});

			it('creates a new Redis instance', async () => {
				const { service } = setup();

				const redisInstance = await service.createRedisInstance();

				expect(redisInstance).toBeInstanceOf(IoRedisAdapter);
			});
		});

		describe('when REDIS_CLUSTER_ENABLED is false', () => {
			const setup = () => {
				const config = new RedisConfig();
				const redisUrl = 'redis://localhost:6379';

				config.REDIS = redisUrl;

				const resolveSrv = jest.fn();
				jest.spyOn(util, 'promisify').mockReturnValueOnce(resolveSrv);

				const redisMock = createMock<Redis>();
				// @ts-ignore
				const constructorSpy = jest.spyOn(Redis.prototype, 'constructor');

				const logger = createMock<Logger>();
				const service = new RedisService(config, logger);

				const expectedProps = redisUrl;

				return { resolveSrv, service, redisMock, constructorSpy, expectedProps };
			};

			it('calls resolveSrv', async () => {
				const { resolveSrv, service } = setup();

				await service.createRedisInstance();

				expect(resolveSrv).not.toHaveBeenCalled();
			});

			it('create new Redis instance with correctly props', async () => {
				const { service, constructorSpy, expectedProps } = setup();

				await service.createRedisInstance();

				expect(constructorSpy).toHaveBeenCalledWith(expectedProps);
			});

			it('creates a new Redis instance', async () => {
				const { service } = setup();

				const redisInstance = await service.createRedisInstance();

				expect(redisInstance).toBeInstanceOf(IoRedisAdapter);
			});
		});
	});
});
