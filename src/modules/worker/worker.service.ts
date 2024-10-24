import { Injectable, OnModuleInit } from '@nestjs/common';
import { Logger } from '../../infra/logging/logger.js';
import { RedisService } from '../../infra/redis/redis.service.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import { createApiClient } from '../../infra/y-redis/api.service.js';
import { WorkerConfig } from './worker.config.js';

@Injectable()
export class WorkerService implements OnModuleInit {
	public constructor(
		private readonly storageService: StorageService,
		private readonly redisService: RedisService,
		private readonly logger: Logger,
		private readonly config: WorkerConfig,
	) {
		this.logger.setContext(WorkerService.name);
	}

	public async onModuleInit(): Promise<void> {
		const client = await createApiClient(this.storageService, this.redisService);

		this.logger.log('WORKER: Created worker process ');
		while (!client._destroyed) {
			try {
				await client.consumeWorkerQueue(
					this.config.WORKER_TRY_CLAIM_COUNT,
					this.config.WORKER_TASK_DEBOUNCE,
					this.config.WORKER_MIN_MESSAGE_LIFETIME,
				);
			} catch (e) {
				this.logger.error(e);
			}
		}
		this.logger.log('WORKER: Ended worker process ');
	}
}
