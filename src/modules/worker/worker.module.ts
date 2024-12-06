import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../../infra/configuration/configuration.module.js';
import { LoggerModule } from '../../infra/logger/logger.module.js';
import { RedisModule } from '../../infra/redis/redis.module.js';
import { StorageModule } from '../../infra/storage/storage.module.js';
import { YRedisModule } from '../../infra/y-redis/y-redis.module.js';
import { WorkerConfig } from './worker.config.js';
import { REDIS_FOR_WORKER } from './worker.const.js';
import { WorkerService } from './worker.service.js';

@Module({
	imports: [
		ConfigurationModule.register(WorkerConfig),
		RedisModule.registerFor(REDIS_FOR_WORKER),
		StorageModule,
		LoggerModule,
		YRedisModule.forRoot(),
	],
	providers: [WorkerService],
})
export class WorkerModule {}
