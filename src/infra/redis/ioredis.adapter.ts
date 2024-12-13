import { Redis } from 'ioredis';
import { Logger } from '../logger/index.js';
import { addMessageCommand, xDelIfEmptyCommand } from './commands.js';
import {
	RedisAdapter,
	StreamMessageReply,
	StreamMessagesReply,
	StreamNameClockPair,
	Task,
	XAutoClaimResponse,
} from './interfaces/index.js';
import { mapToStreamMessagesReplies, mapToStreamMessagesReply, mapToXAutoClaimResponse } from './mapper.js';
import { RedisConfig } from './redis.config.js';

export class IoRedisAdapter implements RedisAdapter {
	public readonly redisPrefix: string;
	public readonly redisDeleteStreamName: string;
	public readonly redisWorkerStreamName: string;
	public readonly redisWorkerGroupName: string;
	public readonly redisDeletionActionKey: string;

	public constructor(
		private readonly redis: Redis,
		private readonly config: RedisConfig,
		private readonly logger: Logger,
	) {
		this.logger.setContext(IoRedisAdapter.name);

		this.redisPrefix = this.config.REDIS_PREFIX;
		this.redisDeleteStreamName = `${this.redisPrefix}:delete`;
		this.redisWorkerStreamName = `${this.redisPrefix}:worker`;
		this.redisWorkerGroupName = `${this.redisPrefix}:worker`;
		this.redisDeletionActionKey = `${this.redisPrefix}:delete:action`;

		redis.defineCommand('addMessage', {
			numberOfKeys: 1,
			lua: addMessageCommand(this.redisWorkerStreamName, this.redisWorkerGroupName),
		});

		redis.defineCommand('xDelIfEmpty', {
			numberOfKeys: 1,
			lua: xDelIfEmptyCommand(),
		});
	}

	public subscribeToDeleteChannel(callback: (message: string) => void): void {
		this.redis.subscribe(this.redisDeletionActionKey);
		this.redis.on('message', (chan, message) => {
			callback(message);
		});
	}

	public async markToDeleteByDocName(docName: string): Promise<void> {
		await this.redis.xadd(this.redisDeleteStreamName, '*', 'docName', docName);
		await this.redis.publish(this.redisDeletionActionKey, docName);
	}

	public async addMessage(key: string, message: unknown): Promise<void> {
		// @ts-ignore
		await this.redis.addMessage(key, message);
	}

	public getEntriesLen(streamName: string): Promise<number> {
		const result = this.redis.xlen(streamName);

		return result;
	}

	public exists(stream: string): Promise<number> {
		const result = this.redis.exists(stream);

		return result;
	}

	public async createGroup(): Promise<void> {
		try {
			await this.redis.xgroup('CREATE', this.redisWorkerStreamName, this.redisWorkerGroupName, '0', 'MKSTREAM');
		} catch (e) {
			this.logger.log(e);
			// It is okay when the group already exists, so we can ignore this error.
			if (e.message !== 'BUSYGROUP Consumer Group name already exists') {
				throw e;
			}
		}
	}

	public async quit(): Promise<void> {
		await this.redis.quit();
	}

	public async readStreams(streams: StreamNameClockPair[]): Promise<StreamMessagesReply[]> {
		const reads = await this.redis.xreadBuffer(
			'COUNT',
			1000,
			'BLOCK',
			1000,
			'STREAMS',
			...streams.map((stream) => stream.key),
			...streams.map((stream) => stream.id),
		);

		const streamReplyRes = mapToStreamMessagesReply(reads);

		return streamReplyRes;
	}

	public async readMessagesFromStream(streamName: string): Promise<StreamMessagesReply[]> {
		const reads = await this.redis.xreadBuffer('STREAMS', streamName, '0');

		const streamReplyRes = mapToStreamMessagesReply(reads);

		return streamReplyRes;
	}

	public async reclaimTasks(
		consumerName: string,
		redisTaskDebounce: number,
		tryClaimCount = 5,
	): Promise<XAutoClaimResponse> {
		const reclaimedTasks = await this.redis.xautoclaim(
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
		const deletedDocEntries = await this.redis.xrange(this.redisDeleteStreamName, '-', '+');

		const transformedDeletedTasks = mapToStreamMessagesReplies(deletedDocEntries);

		return transformedDeletedTasks;
	}

	public deleteDeletedDocEntry(id: string): Promise<number> {
		const result = this.redis.xdel(this.redisDeleteStreamName, id);

		return result;
	}

	public async tryClearTask(task: Task): Promise<number> {
		const streamlen = await this.redis.xlen(task.stream);

		if (streamlen === 0) {
			await this.redis
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
		await this.redis
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
