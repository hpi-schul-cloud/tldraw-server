import { DynamicModule, Module } from '@nestjs/common';
import { RedisAdapter } from 'infra/redis/interfaces/redis-adapter.js';
import { RedisModule } from '../redis/redis.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { StorageService } from '../storage/storage.service.js';
import { Api } from './api.service.js';
import { Subscriber } from './subscriber.service.js';
import { API_FOR_SUBSCRIBER, REDIS_FOR_API, REDIS_FOR_SUBSCRIBER } from './y-redis.const.js';

@Module({})
export class YRedisModule {
	public static forRoot(): DynamicModule {
		return {
			module: YRedisModule,
			imports: [RedisModule.registerFor(REDIS_FOR_SUBSCRIBER), RedisModule.registerFor(REDIS_FOR_API), StorageModule],
			providers: [
				{
					provide: Api,
					useFactory: (redisAdapter: RedisAdapter, storageService: StorageService): Api => {
						const api = new Api(storageService, redisAdapter);

						return api;
					},
					inject: [REDIS_FOR_API, StorageService],
				},
				{
					provide: API_FOR_SUBSCRIBER,
					useFactory: (redisAdapter: RedisAdapter, storageService: StorageService): Api => {
						const api = new Api(storageService, redisAdapter);

						return api;
					},
					inject: [REDIS_FOR_SUBSCRIBER, StorageService],
				},
				{
					provide: Subscriber,
					useFactory: (api: Api): Subscriber => {
						const subscriber = new Subscriber(api);

						return subscriber;
					},
					inject: [API_FOR_SUBSCRIBER],
				},
			],
			exports: [Subscriber, Api],
		};
	}
}
