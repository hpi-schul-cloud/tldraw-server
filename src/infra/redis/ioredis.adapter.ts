import { Redis } from 'ioredis';
import { Logger } from '../logging/logger.js';
import { addMessageCommand, xDelIfEmptyCommand } from './commands.js';
import { Task, XAutoClaimResponse } from './interfaces/redis.interface.js';
import { StreamMessageReply, StreamsMessagesReply } from './interfaces/stream-message-replay.js';
import { StreamNameClockPair } from './interfaces/stream-name-clock-pair.js';
import { mapToStreamMessagesReplies, mapToStreamsMessagesReply, mapToXAutoClaimResponse } from './mapper.js';
import { RedisAdapter } from './redis.adapter.js';
import { RedisConfig } from './redis.config.js';

export class IoRedisAdapter implements RedisAdapter {
	public readonly redisPrefix: string;
	private readonly redisDeleteStreamName: string;
	private readonly redisWorkerStreamName: string;
	private readonly redisWorkerGroupName: string;
	private readonly redisDeletionActionKey: string;

	public constructor(
		private readonly internalRedisInstance: Redis,
		private readonly config: RedisConfig,
		private readonly logger: Logger,
	) {
		this.logger.setContext(IoRedisAdapter.name);

		this.redisPrefix = this.config.REDIS_PREFIX;
		this.redisDeleteStreamName = `${this.redisPrefix}:delete`;
		this.redisWorkerStreamName = `${this.redisPrefix}:worker`;
		this.redisWorkerGroupName = `${this.redisPrefix}:worker`;
		this.redisDeletionActionKey = `${this.redisPrefix}:delete:action`;

		internalRedisInstance.defineCommand('addMessage', {
			numberOfKeys: 1,
			lua: addMessageCommand(this.redisWorkerStreamName, this.redisWorkerGroupName),
		});

		internalRedisInstance.defineCommand('xDelIfEmpty', {
			numberOfKeys: 1,
			lua: xDelIfEmptyCommand(),
		});
	}

	public subscribeToDeleteChannel(callback: (message: string) => void): void {
		this.internalRedisInstance.subscribe(this.redisDeletionActionKey);
		this.internalRedisInstance.on('message', (chan, message) => {
			callback(message);
		});
	}

	public async markToDeleteByDocName(docName: string): Promise<void> {
		await this.internalRedisInstance.xadd(this.redisDeleteStreamName, '*', 'docName', docName);
		await this.internalRedisInstance.publish(this.redisDeletionActionKey, docName);
	}

	public addMessage(key: string, message: unknown): Promise<null> {
		// @ts-ignore
		const result = this.internalRedisInstance.addMessage(key, message);

		return result;
	}

	public getEntriesLen(streamName: string): Promise<number> {
		const result = this.internalRedisInstance.xlen(streamName);

		return result;
	}

	public exists(stream: string): Promise<number> {
		const result = this.internalRedisInstance.exists(stream);

		return result;
	}

	public async createGroup(): Promise<void> {
		try {
			await this.internalRedisInstance.xgroup(
				'CREATE',
				this.redisWorkerStreamName,
				this.redisWorkerGroupName,
				'0',
				'MKSTREAM',
			);
		} catch (e) {
			this.logger.log(e);
			// It is okay when the group already exists, so we can ignore this error.
			if (e.message !== 'BUSYGROUP Consumer Group name already exists') {
				throw e;
			}
		}
	}

	public async quit(): Promise<void> {
		await this.internalRedisInstance.quit();
	}

	public async readStreams(streams: StreamNameClockPair[]): Promise<StreamsMessagesReply> {
		const reads = await this.internalRedisInstance.xreadBuffer(
			'COUNT',
			1000,
			'BLOCK',
			1000,
			'STREAMS',
			...streams.map((stream) => stream.key),
			...streams.map((stream) => stream.id),
		);

		const streamReplyRes = mapToStreamsMessagesReply(reads);

		return streamReplyRes;
	}

	public async readMessagesFromStream(streamName: string): Promise<StreamsMessagesReply> {
		const reads = await this.internalRedisInstance.xreadBuffer(
			'COUNT',
			1000, // Adjust the count as needed
			'BLOCK',
			1000, // Adjust the block time as needed
			'STREAMS',
			streamName,
			'0',
		);

		const streamReplyRes = mapToStreamsMessagesReply(reads);

		return streamReplyRes;
	}

	public async reclaimTasks(
		consumerName: string,
		redisTaskDebounce: number,
		tryClaimCount = 5,
	): Promise<XAutoClaimResponse> {
		const reclaimedTasks = await this.internalRedisInstance.xautoclaim(
			this.redisWorkerStreamName,
			this.redisWorkerGroupName,
			consumerName,
			redisTaskDebounce,
			'0',
			'COUNT',
			tryClaimCount,
		);

		const reclaimedTasksRes = mapToXAutoClaimResponse(reclaimedTasks);

		return reclaimedTasksRes;
	}

	public async getDeletedDocEntries(): Promise<StreamMessageReply[]> {
		const deletedDocEntries = await this.internalRedisInstance.xrangeBuffer(this.redisDeleteStreamName, '-', '+');

		const transformedDeletedTasks = mapToStreamMessagesReplies(deletedDocEntries);

		return transformedDeletedTasks;
	}

	public deleteDeleteDocEntry(id: string): Promise<number> {
		const result = this.internalRedisInstance.xdel(this.redisDeleteStreamName, id);

		return result;
	}

	public async tryClearTask(task: Task): Promise<number> {
		const streamlen = await this.internalRedisInstance.xlen(task.stream);

		if (streamlen === 0) {
			await this.internalRedisInstance
				.multi()
				// @ts-ignore
				.xDelIfEmpty(task.stream)
				.xdel(this.redisWorkerStreamName, task.id)
				.exec();
		}

		return streamlen;
	}

	public async tryDeduplicateTask(task: Task, lastId: number, redisMinMessageLifetime: number): Promise<void> {
		// if `redisTaskDebounce` is small, or if updateCallback taskes too long, then we might
		// add a task twice to this list.
		// @todo either use a different datastructure or make sure that task doesn't exist yet
		// before adding it to the worker queue
		// This issue is not critical, as no data will be lost if this happens.
		await this.internalRedisInstance
			.multi()
			.xtrim(task.stream, 'MINID', lastId - redisMinMessageLifetime)
			.xadd(this.redisWorkerStreamName, '*', 'compact', task.stream)
			.xreadgroup(
				'GROUP',
				this.redisWorkerGroupName,
				'pending',
				'COUNT',
				50,
				'STREAMS',
				this.redisWorkerStreamName,
				'>',
			) // immediately claim this entry, will be picked up by worker after timeout
			.xdel(this.redisWorkerStreamName, task.id)
			.exec();
	}
}
