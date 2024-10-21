import { Injectable, OnModuleInit } from '@nestjs/common';
import { RedisService } from '../../infra/redis/redis.service.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import { createWorker } from '../../infra/y-redis/worker.service.js';
import { WorkerConfig } from './worker.config.js';

@Injectable()
export class WorkerService implements OnModuleInit {
	public constructor(
		private readonly storageService: StorageService,
		private readonly redisService: RedisService,
		private readonly config: WorkerConfig,
	) {}

	public async onModuleInit(): Promise<void> {
		const worker = await createWorker(this.storageService, this.config.REDIS_PREFIX, this.redisService);
		await worker.run();
	}
}
