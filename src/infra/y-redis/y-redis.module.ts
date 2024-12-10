import { DynamicModule, Module } from '@nestjs/common';
import { Logger } from '../logger/logger.js';
import { LoggerModule } from '../logger/logger.module.js';
import { RedisAdapter } from '../redis/interfaces/redis-adapter.js';
import { RedisModule } from '../redis/redis.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { StorageService } from '../storage/storage.service.js';
import { Subscriber } from './subscriber.service.js';
import { YRedisClient } from './y-redis.client.js';
import { API_FOR_SUBSCRIBER, REDIS_FOR_API, REDIS_FOR_SUBSCRIBER } from './y-redis.const.js';
import { YRedisService } from './y-redis.service.js';

@Module({})
export class YRedisModule {
	public static forRoot(): DynamicModule {
		return {
			module: YRedisModule,
			imports: [
				RedisModule.registerFor(REDIS_FOR_SUBSCRIBER),
				RedisModule.registerFor(REDIS_FOR_API),
				StorageModule,
				LoggerModule,
			],
			providers: [
				YRedisService,
				{
					provide: YRedisClient,
					useFactory: (redisAdapter: RedisAdapter, storageService: StorageService, logger: Logger): YRedisClient => {
						const yRedisClient = new YRedisClient(storageService, redisAdapter, logger);

						return yRedisClient;
					},
					inject: [REDIS_FOR_API, StorageService, Logger],
				},
				{
					provide: API_FOR_SUBSCRIBER,
					useFactory: (redisAdapter: RedisAdapter, storageService: StorageService, logger: Logger): YRedisClient => {
						const yRedisClient = new YRedisClient(storageService, redisAdapter, logger);

						return yRedisClient;
					},
					inject: [REDIS_FOR_SUBSCRIBER, StorageService, Logger],
				},
				{
					provide: Subscriber,
					useFactory: (yRedisClient: YRedisClient): Subscriber => {
						const subscriber = new Subscriber(yRedisClient);

						return subscriber;
					},
					inject: [API_FOR_SUBSCRIBER],
				},
			],
			exports: [Subscriber, YRedisClient, YRedisService],
		};
	}
}
