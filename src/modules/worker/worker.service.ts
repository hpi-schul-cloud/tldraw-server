import { Injectable, OnModuleInit } from '@nestjs/common';
import { RedisAdapter } from 'infra/redis/interfaces/redis-adapter.js';
import { randomUUID } from 'node:crypto';
import { Logger } from '../../infra/logger/index.js';
import { Task } from '../../infra/redis/interfaces/redis.js';
import { RedisService } from '../../infra/redis/redis.service.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import { Api, createApiClient } from '../../infra/y-redis/api.service.js';
import { decodeRedisRoomStreamName } from '../../infra/y-redis/helper.js';
import { WorkerConfig } from './worker.config.js';

@Injectable()
export class WorkerService implements OnModuleInit {
	private client!: Api;
	private readonly consumerId = randomUUID();
	private redis!: RedisAdapter;

	public constructor(
		private readonly storageService: StorageService,
		private readonly redisService: RedisService,
		private readonly logger: Logger,
		private readonly config: WorkerConfig,
	) {
		this.logger.setContext(WorkerService.name);
	}

	public async onModuleInit(): Promise<void> {
		this.client = await createApiClient(this.storageService, this.redisService);
		this.redis = await this.redisService.createRedisInstance();

		this.logger.log(`Created worker process ${this.consumerId}`);
		while (!this.client._destroyed) {
			await this.consumeWorkerQueue();
		}
		this.logger.log(`Ended worker process ${this.consumerId}`);
	}

	public async consumeWorkerQueue(): Promise<Task[]> {
		const tryClaimCount = this.config.WORKER_TRY_CLAIM_COUNT;
		const taskDebounce = this.config.WORKER_TASK_DEBOUNCE;
		const minMessageLifetime = this.config.WORKER_MIN_MESSAGE_LIFETIME;
		const tasks: Task[] = [];

		const reclaimedTasks = await this.redis.reclaimTasks(this.consumerId, taskDebounce, tryClaimCount);

		const deletedDocEntries = await this.redis.getDeletedDocEntries();
		const deletedDocNames = deletedDocEntries?.map((entry) => {
			return entry.message.docName;
		});

		reclaimedTasks.messages?.forEach((m) => {
			const stream = m?.message.compact;
			stream && tasks.push({ stream: stream.toString(), id: m?.id.toString() });
		});
		if (tasks.length === 0) {
			this.logger.log(`No tasks available, pausing... ${JSON.stringify({ tasks })}`);
			await new Promise((resolve) => setTimeout(resolve, 1000));

			return [];
		}

		this.logger.log(`Accepted tasks ${JSON.stringify({ tasks })}`);

		await Promise.all(
			tasks.map(async (task) => {
				const streamlen = await this.redis.tryClearTask(task);
				const { room, docid } = decodeRedisRoomStreamName(task.stream.toString(), this.redis.redisPrefix);

				if (streamlen === 0) {
					this.logger.log(
						`Stream still empty, removing recurring task from queue ${JSON.stringify({ stream: task.stream })}`,
					);

					const deleteEntryId = deletedDocEntries.find((entry) => entry.message.docName === task.stream)?.id.toString();

					if (deleteEntryId) {
						this.redis.deleteDeleteDocEntry(deleteEntryId);
						this.storageService.deleteDocument(room, docid);
					}
				} else {
					// @todo, make sure that awareness by this.getDoc is eventually destroyed, or doesn't
					// register a timeout anymore
					this.logger.log('requesting doc from store');
					const { ydoc, storeReferences, redisLastId, docChanged, awareness } = await this.client.getDoc(room, docid);

					// awareness is destroyed here to avoid memory leaks, see: https://github.com/yjs/y-redis/issues/24
					awareness.destroy();
					this.logger.log(
						'retrieved doc from store. redisLastId=' + redisLastId + ' storeRefs=' + JSON.stringify(storeReferences),
					);
					const lastId = Math.max(parseInt(redisLastId.split('-')[0]), parseInt(task.id.split('-')[0]));
					if (docChanged) {
						this.logger.log('persisting doc');
						if (!deletedDocNames.includes(task.stream)) {
							await this.storageService.persistDoc(room, docid, ydoc);
						}
					}

					await Promise.all([
						storeReferences && docChanged
							? this.storageService.deleteReferences(room, docid, storeReferences)
							: Promise.resolve(),
						this.redis.tryDeduplicateTask(task, lastId, minMessageLifetime),
					]);

					this.logger.log(
						`Compacted stream
						${JSON.stringify({
							stream: task.stream,
							taskId: task.id,
							newLastId: lastId - minMessageLifetime,
						})}`,
					);
				}
			}),
		);

		return tasks;
	}
}
