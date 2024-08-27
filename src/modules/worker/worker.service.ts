import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWorker } from '@y/redis';
import { RedisService } from '../../infra/redis/redis.service.js';
import { StorageService } from '../../infra/storage/storage.service.js';

@Injectable()
export class WorkerService implements OnModuleInit {
	constructor(
		private storage: StorageService,
		private redisService: RedisService,
		private configService: ConfigService,
	) {}

	async onModuleInit() {
		await createWorker(
			await this.storage.get(),
			this.configService.get<string>('REDIS_PREFIX') || 'y',
			{},
			this.redisService.createRedisInstance.bind(this.redisService),
		);
	}
}
