import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RedisKey } from 'ioredis';
import { Logger } from '../../infra/logger/index.js';
import { RedisAdapter, StreamMessageReply, Task, XAutoClaimResponse } from '../../infra/redis/interfaces/index.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import { decodeRedisRoomStreamName, RoomStreamInfos } from '../../infra/y-redis/helper.js';
import { YRedisDoc } from '../../infra/y-redis/y-redis-doc.js';
import { YRedisClient } from '../../infra/y-redis/y-redis.client.js';
import { WorkerConfig } from './worker.config.js';
import { REDIS_FOR_WORKER } from './worker.const.js';

interface Job {
	status(): boolean;
	start(): void;
	stop(): void;
}

@Injectable()
export class WorkerService implements Job, OnModuleDestroy {
	private readonly consumerId = randomUUID();
	private running = true;

	public constructor(
		private readonly storageService: StorageService,
		@Inject(REDIS_FOR_WORKER) private readonly redis: RedisAdapter,
		private readonly logger: Logger,
		private readonly config: WorkerConfig,
		private readonly yRedisClient: YRedisClient,
	) {
		this.logger.setContext(WorkerService.name);
	}

	public async onModuleDestroy(): Promise<void> {
		this.stop();
		await this.yRedisClient.destroy();
	}

	public async start(): Promise<void> {
		this.running = true;

		while (this.running) {
			const tasks = await this.consumeWorkerQueue();
			await this.waitIfNoOpenTask(tasks, this.config.WORKER_IDLE_BREAK_MS);
		}

		this.logger.log(`Start worker process ${this.consumerId}`);
	}

	public stop(): void {
		this.running = false;
		this.logger.log(`Ended worker process ${this.consumerId}`);
	}

	public status(): boolean {
		return this.running;
	}

	public async consumeWorkerQueue(): Promise<Task[]> {
		const reclaimedTasks = await this.reclaimTasksInRedis();
		const tasks = this.mapReclaimTaskToTask(reclaimedTasks);

		const promises = tasks.map((task: Task) => this.processTask(task));
		await Promise.all(promises);

		return tasks;
	}

	private async processTask(task: Task): Promise<void> {
		const [deletedDocEntries, streamLength] = await Promise.all([
			this.redis.getDeletedDocEntries(),
			this.redis.tryClearTask(task),
		]);

		try {
			if (this.streamIsEmpty(streamLength)) {
				this.removingRecurringTaskFromQueue(task, deletedDocEntries);
			} else {
				await this.processUpdateChanges(deletedDocEntries, task);
			}
		} catch (error: unknown) {
			this.logger.warning({ error, deletedDocEntries, task, message: 'processTask' });
		}
	}

	private async processUpdateChanges(deletedDocEntries: StreamMessageReply[], task: Task): Promise<void> {
		this.logger.log('requesting doc from store');
		const roomStreamInfos = decodeRedisRoomStreamName(task.stream.toString(), this.redis.redisPrefix);
		const yRedisDoc = await this.yRedisClient.getDoc(roomStreamInfos.room, roomStreamInfos.docid);

		this.destroyAwarenessToAvoidMemoryLeaks(yRedisDoc);
		this.logDoc(yRedisDoc);
		const lastId = this.determineLastId(yRedisDoc, task);

		const deletedDocNames = this.extractDocNamesFromStreamMessageReply(deletedDocEntries);
		if (this.docChangedButNotDeleted(yRedisDoc, deletedDocNames, task)) {
			await this.storageService.persistDoc(roomStreamInfos.room, roomStreamInfos.docid, yRedisDoc.ydoc);
		}

		await Promise.all([
			this.redis.tryDeduplicateTask(task, lastId, this.config.WORKER_MIN_MESSAGE_LIFETIME),
			this.deleteStorageReferencesIfExist(yRedisDoc, roomStreamInfos),
		]);

		this.logStream(task, lastId - this.config.WORKER_MIN_MESSAGE_LIFETIME);
	}

	private async waitIfNoOpenTask(tasks: Task[], waitInMs: number): Promise<void> {
		if (tasks.length === 0) {
			this.logger.log(`No tasks available, pausing... ${JSON.stringify({ tasks })}`);
			await new Promise((resolve) => setTimeout(resolve, waitInMs));
		}
	}

	private async reclaimTasksInRedis(): Promise<XAutoClaimResponse> {
		const reclaimedTasks = await this.redis.reclaimTasks(
			this.consumerId,
			this.config.WORKER_TASK_DEBOUNCE,
			this.config.WORKER_TRY_CLAIM_COUNT,
		);

		return reclaimedTasks;
	}

	private destroyAwarenessToAvoidMemoryLeaks(yRedisDoc: YRedisDoc): void {
		// @see: https://github.com/yjs/y-redis/issues/24
		yRedisDoc.awareness.destroy();
	}

	private async removingRecurringTaskFromQueue(task: Task, deletedDocEntries: StreamMessageReply[]): Promise<void> {
		this.logger.log(
			`Stream still empty, removing recurring task from queue ${JSON.stringify({ stream: task.stream })}`,
		);

		const deleteEntryId = deletedDocEntries.find((entry) => entry.message.docName === task.stream)?.id.toString();

		if (deleteEntryId) {
			const roomStreamInfos = decodeRedisRoomStreamName(task.stream.toString(), this.redis.redisPrefix);
			await Promise.all([
				this.redis.deleteDeletedDocEntry(deleteEntryId),
				this.storageService.deleteDocument(roomStreamInfos.room, roomStreamInfos.docid),
			]);
		}
	}

	private deleteStorageReferencesIfExist(yRedisDoc: YRedisDoc, roomStreamInfos: RoomStreamInfos): Promise<void> {
		let promise = Promise.resolve();

		if (this.isDocumentChangedAndReferencesAvaible(yRedisDoc)) {
			const storeReferences = this.castToStringArray(yRedisDoc.storeReferences);
			promise = this.storageService.deleteReferences(roomStreamInfos.room, roomStreamInfos.docid, storeReferences);
		}

		return promise;
	}

	// helper
	private mapReclaimTaskToTask(reclaimedTasks: XAutoClaimResponse): Task[] {
		const tasks: Task[] = [];
		reclaimedTasks.messages?.forEach((m) => {
			const stream = m?.message.compact;
			stream && tasks.push({ stream: stream.toString(), id: m?.id.toString() });
		});

		if (tasks.length > 0) {
			this.logger.log(`Accepted tasks ${JSON.stringify({ tasks })}`);
		}

		return tasks;
	}

	private determineLastId(yRedisDoc: YRedisDoc, task: Task): number {
		const lastId = Math.max(parseInt(yRedisDoc.redisLastId.split('-')[0]), parseInt(task.id.split('-')[0]));

		return lastId;
	}

	private extractDocNamesFromStreamMessageReply(docEntries: StreamMessageReply[]): string[] {
		const docNames = docEntries
			.map((entry) => {
				return entry.message.docName;
			})
			.filter((docName) => docName !== undefined);

		return docNames;
	}

	private castToStringArray(input: string[] | null): string[] {
		if (input) {
			return input;
		}

		throw new Error(`Input ${input} can not be castet to string[].`);
	}

	private docChangedButNotDeleted(yRedisDoc: YRedisDoc, deletedDocNames: RedisKey[], task: Task): boolean {
		return yRedisDoc.docChanged && !deletedDocNames.includes(task.stream);
	}

	private isDocumentChangedAndReferencesAvaible(yRedisDoc: YRedisDoc): boolean {
		return yRedisDoc.storeReferences !== null && yRedisDoc.docChanged === true;
	}

	private streamIsEmpty(streamLength: number): boolean {
		return streamLength === 0;
	}

	// logs
	private logDoc(yRedisDoc: YRedisDoc): void {
		this.logger.log(
			'retrieved doc from store. redisLastId=' +
				yRedisDoc.redisLastId +
				' storeRefs=' +
				JSON.stringify(yRedisDoc.storeReferences),
		);
	}

	private logStream(task: Task, newLastId: number): void {
		this.logger.log(
			`Compacted stream
			${JSON.stringify({
				stream: task.stream,
				taskId: task.id,
				newLastId,
			})}`,
		);
	}
}
