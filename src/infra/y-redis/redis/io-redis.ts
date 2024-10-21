import { Redis, RedisKey } from 'ioredis';
import { addMessageCommand, xDelIfEmptyCommand } from './commands.js';
import { StreamMessageReply, StreamsMessagesReply } from './interfaces/stream-message-replay.js';
import { StreamNameClockPair } from './interfaces/stream-name-clock-pair.js';

type XItem = [id: Buffer, fields: Buffer[]];
type XItems = XItem[];
type XReadBufferReply = [key: Buffer, items: XItems][] | null;

type XAutoClaimRawReply = [RedisKey, XItem[]];
type XRangeResponse = [id: string, fields: string[]][];

interface XAutoClaimResponse {
	nextId: RedisKey;
	messages: StreamMessageReply[] | null;
}

interface Task {
	stream: RedisKey;
	id: string;
}

export class IoRedisAdapter {
	private readonly redisDeleteStreamName: string;
	private readonly redisWorkerStreamName: string;
	private readonly redisWorkerGroupName: string;
	private readonly redis: Redis;

	public constructor(redis: Redis, prefix: string) {
		this.redisDeleteStreamName = prefix + ':delete';
		this.redisWorkerStreamName = prefix + ':worker';
		this.redisWorkerGroupName = prefix + ':worker';
		this.redis = redis;

		this.redis.defineCommand('addMessage', {
			numberOfKeys: 1,
			lua: addMessageCommand(this.redisWorkerStreamName, this.redisWorkerGroupName),
		});

		this.redis.defineCommand('xDelIfEmpty', {
			numberOfKeys: 1,
			lua: xDelIfEmptyCommand(),
		});
	}

	public addMessage(key: string, message: unknown): Promise<unknown> {
		// @ts-ignore
		const result = this.redis.addMessage(key, message);

		return result;
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
		} catch (error) {
			console.log(error);
		}
	}

	public quit(): Promise<string> {
		const result = this.redis.quit();

		return result;
	}

	public async readStreams(streams: StreamNameClockPair[]): Promise<StreamsMessagesReply> {
		const reads = await this.redis.xreadBuffer(
			'COUNT',
			1000,
			'BLOCK',
			1000,
			'STREAMS',
			...streams.map((stream) => stream.key),
			...streams.map((stream) => stream.id),
		);

		const streamReplyRes = this.normalizeStreamMessagesReply(reads);

		return streamReplyRes;
	}

	public async readMessagesFromStream(computeRedisRoomStreamName: string): Promise<StreamsMessagesReply> {
		const reads = await this.redis.xreadBuffer(
			'COUNT',
			1000, // Adjust the count as needed
			'BLOCK',
			1000, // Adjust the block time as needed
			'STREAMS',
			computeRedisRoomStreamName,
			'0',
		);

		const streamReplyRes = this.normalizeStreamMessagesReply(reads);

		return streamReplyRes;
	}

	public async reclaimTasks(
		consumerName: string,
		redisTaskDebounce: number,
		tryClaimCount = 5,
	): Promise<XAutoClaimResponse> {
		const reclaimedTasks = (await this.redis.xautoclaim(
			this.redisWorkerStreamName,
			this.redisWorkerGroupName,
			consumerName,
			redisTaskDebounce,
			'0',
			'COUNT',
			tryClaimCount,
		)) as XAutoClaimRawReply;

		const reclaimedTasksRes = transformXAutoClaimReply(reclaimedTasks);

		return reclaimedTasksRes;
	}

	public async markToDeleteByDocName(docName: string): Promise<void> {
		await this.redis.xadd(this.redisDeleteStreamName, '*', 'docName', docName);
	}

	public async getDeletedDocEntries(): Promise<StreamMessageReply[]> {
		const deletedDocEntries = await this.redis.xrangeBuffer(this.redisDeleteStreamName, '-', '+');

		const transformedDeletedTasks = transformStreamMessagesReply(deletedDocEntries);

		return transformedDeletedTasks;
	}

	public deleteDeleteDocEntry(id: string): Promise<number> {
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

	public tryDeduplicateTask(task: Task, lastId: number, redisMinMessageLifetime: number): Promise<unknown> {
		// if `redisTaskDebounce` is small, or if updateCallback taskes too long, then we might
		// add a task twice to this list.
		// @todo either use a different datastructure or make sure that task doesn't exist yet
		// before adding it to the worker queue
		// This issue is not critical, as no data will be lost if this happens.
		return this.redis
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

	private normalizeStreamMessagesReply(streamReply: XReadBufferReply): StreamsMessagesReply {
		if (streamReply === null) {
			return [];
		}

		const result = streamReply.map(([name, messages]) => {
			return {
				name: name.toString(),
				messages: transformStreamMessagesReply(messages),
			};
		});

		return result;
	}
}

function transformXAutoClaimReply(reply: XAutoClaimRawReply): XAutoClaimResponse {
	if (reply === null) {
		return { nextId: '', messages: null };
	}

	return {
		nextId: reply[0],
		messages: transformStreamMessagesReply(reply[1]),
	};
}

function transformStreamMessagesReply(messages: XItems): StreamMessageReply[] {
	if (messages === null) {
		return [];
	}

	const result = messages.map((value) => {
		return transformStreamMessageReply(value);
	});

	return result;
}

function transformStreamMessageReply(value: XItem): StreamMessageReply {
	const [id, fields] = value;

	return { id: id.toString(), message: transformTuplesReply(fields) };
}

function transformTuplesReply(reply: RedisKey[]): Record<string, RedisKey> {
	const message: Record<string, RedisKey> = Object.create(null);

	for (let i = 0; i < reply.length; i += 2) {
		message[reply[i].toString()] = reply[i + 1];
	}

	return message;
}
