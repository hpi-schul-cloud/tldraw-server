import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../../infra/configuration/configuration.module.js';
import { RedisModule } from '../../infra/redis/redis.module.js';
import { StorageModule } from '../../infra/storage/storage.module.js';
import { WorkerConfig } from './worker.config.js';
import { WorkerService } from './worker.service.js';

@Module({
	imports: [ConfigurationModule.register(WorkerConfig), RedisModule, StorageModule],
	providers: [WorkerService],
})
export class WorkerModule {}
