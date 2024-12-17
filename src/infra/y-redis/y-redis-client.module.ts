import { DynamicModule, Module } from '@nestjs/common';
import { Logger } from '../logger/logger.js';
import { LoggerModule } from '../logger/logger.module.js';
import { RedisAdapter } from '../redis/interfaces/redis-adapter.js';
import { RedisModule } from '../redis/redis.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { StorageService } from '../storage/storage.service.js';
import { YRedisClient } from './y-redis.client.js';
import { REDIS_FOR_API } from './y-redis.const.js';

@Module({})
export class YRedisClientModule {
	public static register(): DynamicModule {
		return {
			module: YRedisClientModule,
			imports: [RedisModule.registerFor(REDIS_FOR_API), StorageModule, LoggerModule],
			providers: [
				{
					provide: YRedisClient,
					useFactory: (redisAdapter: RedisAdapter, storageService: StorageService, logger: Logger): YRedisClient => {
						const yRedisClient = new YRedisClient(storageService, redisAdapter, logger);

						return yRedisClient;
					},
					inject: [REDIS_FOR_API, StorageService, Logger],
				},
			],
			exports: [YRedisClient],
		};
	}
}
