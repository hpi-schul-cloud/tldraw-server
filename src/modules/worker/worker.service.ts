import { Injectable, OnModuleInit } from '@nestjs/common';
// @ts-expect-error - @y/redis is only having jsdoc types
import { createWorker } from '@y/redis';
import { RedisService } from '../../infra/redis/redis.service.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import { WorkerConfig } from './worker.config.js';

@Injectable()
export class WorkerService implements OnModuleInit {
	public constructor(
		private readonly storage: StorageService,
		private readonly redisService: RedisService,
		private readonly config: WorkerConfig,
	) {}

	public async onModuleInit(): Promise<void> {
		await createWorker(
			await this.storage.get(),
			this.config.REDIS_PREFIX,
			{},
			this.redisService.createRedisInstance.bind(this.redisService),
		);
	}
}
