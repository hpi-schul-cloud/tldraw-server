import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../../infra/configuration/index.js';
import { LoggerModule } from '../../infra/logger/index.js';
import { RedisModule } from '../../infra/redis/index.js';
import { StorageModule } from '../../infra/storage/index.js';
import { YRedisClientModule } from '../../infra/y-redis/index.js';
import { WorkerConfig } from './worker.config.js';
import { REDIS_FOR_WORKER } from './worker.const.js';
import { WorkerService } from './worker.service.js';

@Module({
	imports: [
		ConfigurationModule.register(WorkerConfig),
		RedisModule.registerFor(REDIS_FOR_WORKER),
		StorageModule,
		LoggerModule,
		YRedisClientModule.register(),
	],
	providers: [WorkerService],
})
export class WorkerModule {}
