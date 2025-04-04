import { createMock } from '@golevelup/ts-jest';
import { Redis } from 'ioredis';
import * as util from 'util';
import { Logger } from '../logger/index.js';
import { IoRedisAdapter } from './ioredis.adapter.js';
import { RedisConfig } from './redis.config.js';
import { RedisFactory } from './redis.factory.js';

jest.mock('ioredis', () => {
	return {
		Redis: jest.fn(),
	};
});

jest.mock<IoRedisAdapter>('./ioredis.adapter.js');

describe(RedisFactory.name, () => {
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

				config.REDIS_URL = sentinelServiceName;
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
				const factory = new RedisFactory(config, logger);

				const expectedProps = {
					sentinels: [
						{ host: name1, port: port1 },
						{ host: name2, port: port2 },
					],
					sentinelPassword: 'sentinelPassword',
					password: 'sentinelPassword',
					name: 'sentinelName',
				};

				return { resolveSrv, sentinelServiceName, factory, constructorSpy, expectedProps };
			};

			it('calls resolveSrv', async () => {
				const { resolveSrv, sentinelServiceName, factory } = setup();

				await factory.createRedisInstance();

				expect(resolveSrv).toHaveBeenLastCalledWith(sentinelServiceName);
			});

			it('create new Redis instance with correctly props', async () => {
				const { factory, constructorSpy, expectedProps } = setup();

				await factory.createRedisInstance();

				expect(constructorSpy).toHaveBeenCalledWith(expectedProps);
			});

			it('creates a new Redis instance', async () => {
				const { factory } = setup();

				const redisInstance = await factory.createRedisInstance();

				expect(redisInstance).toBeInstanceOf(IoRedisAdapter);
			});
		});

		describe('when REDIS_CLUSTER_ENABLED is false', () => {
			const setup = () => {
				const config = new RedisConfig();
				const redisUrl = 'redis://localhost:6379';

				config.REDIS_URL = redisUrl;

				const resolveSrv = jest.fn();
				jest.spyOn(util, 'promisify').mockReturnValueOnce(resolveSrv);

				const redisMock = createMock<Redis>();
				// @ts-ignore
				const constructorSpy = jest.spyOn(Redis.prototype, 'constructor');

				const logger = createMock<Logger>();
				const factory = new RedisFactory(config, logger);

				const expectedProps = redisUrl;

				return { resolveSrv, factory, redisMock, constructorSpy, expectedProps };
			};

			it('calls resolveSrv', async () => {
				const { resolveSrv, factory } = setup();

				await factory.createRedisInstance();

				expect(resolveSrv).not.toHaveBeenCalled();
			});

			it('create new Redis instance with correctly props', async () => {
				const { factory, constructorSpy, expectedProps } = setup();

				await factory.createRedisInstance();

				expect(constructorSpy).toHaveBeenCalledWith(expectedProps);
			});

			it('creates a new Redis instance', async () => {
				const { factory } = setup();

				const redisInstance = await factory.createRedisInstance();

				expect(redisInstance).toBeInstanceOf(IoRedisAdapter);
			});
		});
	});
});
