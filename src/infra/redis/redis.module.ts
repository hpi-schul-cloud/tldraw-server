import { DynamicModule, Module } from '@nestjs/common';
import { ConfigurationModule } from '../configuration/configuration.module.js';
import { Logger } from '../logger/logger.js';
import { LoggerModule } from '../logger/logger.module.js';
import { RedisAdapter } from './interfaces/redis-adapter.js';
import { RedisConfig } from './redis.config.js';
import { RedisFactory } from './redis.factory.js';

@Module({})
export class RedisModule {
	public static registerFor(token: string): DynamicModule {
		return {
			module: RedisModule,
			imports: [LoggerModule, ConfigurationModule.register(RedisConfig)],
			providers: [
				{
					provide: token,
					useFactory: async (config: RedisConfig, logger: Logger): Promise<RedisAdapter> => {
						logger.setContext(`${RedisFactory.name} - ${token}`);

						const redisFactory = new RedisFactory(config, logger);
						const redisAdapter = await redisFactory.createRedisInstance();

						return redisAdapter;
					},
					inject: [RedisConfig, Logger],
				},
			],
			exports: [token],
		};
	}
}
