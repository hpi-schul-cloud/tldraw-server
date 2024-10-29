import { createMock } from '@golevelup/ts-jest';
import { Redis } from 'ioredis';
import * as util from 'util';
import { LegacyLogger } from '../logger/index.js';
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

				const logger = createMock<LegacyLogger>();
				const service = new RedisService(config, logger);

				return { resolveSrv, sentinelServiceName, service, constructorSpy };
			};

			it('calls resolveSrv', async () => {
				const { resolveSrv, sentinelServiceName, service } = setup();

				await service.createRedisInstance();

				expect(resolveSrv).toHaveBeenLastCalledWith(sentinelServiceName);
			});

			it('create new Redis instance with correctly props', async () => {
				const { service, constructorSpy } = setup();

				await service.createRedisInstance();

				expect(constructorSpy).toHaveBeenCalledWith({
					sentinels: [
						{ host: 'name1', port: 11 },
						{ host: 'name2', port: 22 },
					],
					sentinelPassword: 'sentinelPassword',
					password: 'sentinelPassword',
					name: 'sentinelName',
				});
			});

			it('creates a new Redis instance', async () => {
				const { service } = setup();

				const redisInstance = await service.createRedisInstance();

				expect(redisInstance).toBeInstanceOf(Redis);
			});
		});

		describe('when REDIS_CLUSTER_ENABLED is false', () => {
			const setup = () => {
				const config = new RedisConfig();

				config.REDIS = 'redis://localhost:6379';

				const resolveSrv = jest.fn();
				jest.spyOn(util, 'promisify').mockReturnValueOnce(resolveSrv);

				const redisMock = createMock<Redis>();
				// @ts-ignore
				const constructorSpy = jest.spyOn(Redis.prototype, 'constructor');

				const logger = createMock<LegacyLogger>();
				const service = new RedisService(config, logger);

				return { resolveSrv, service, redisMock, constructorSpy };
			};

			it('calls resolveSrv', async () => {
				const { resolveSrv, service } = setup();

				await service.createRedisInstance();

				expect(resolveSrv).not.toHaveBeenCalled();
			});

			it('create new Redis instance with correctly props', async () => {
				const { service, constructorSpy } = setup();

				await service.createRedisInstance();

				expect(constructorSpy).toHaveBeenCalledWith('redis://localhost:6379');
			});

			it('creates a new Redis instance', async () => {
				const { service } = setup();

				const redisInstance = await service.createRedisInstance();

				expect(redisInstance).toBeInstanceOf(Redis);
			});
		});
	});
});
