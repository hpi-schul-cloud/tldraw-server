import { Task, XAutoClaimResponse } from './interfaces/redis.interface.js';
import { StreamMessageReply, StreamsMessagesReply } from './interfaces/stream-message-replay.js';
import { StreamNameClockPair } from './interfaces/stream-name-clock-pair.js';

export interface RedisAdapter {
	readonly redisPrefix: string;
	subscribeToDeleteChannel(callback: (message: string) => void): void;
	markToDeleteByDocName(docName: string): Promise<void>;
	addMessage(key: string, message: unknown): Promise<null>;
	getEntriesLen(streamName: string): Promise<number>;
	exists(stream: string): Promise<number>;
	createGroup(): Promise<void>;
	quit(): Promise<void>;
	readStreams(streams: StreamNameClockPair[]): Promise<StreamsMessagesReply>;
	readMessagesFromStream(streamName: string): Promise<StreamsMessagesReply>;
	reclaimTasks(consumerName: string, redisTaskDebounce: number, tryClaimCount: number): Promise<XAutoClaimResponse>;
	getDeletedDocEntries(): Promise<StreamMessageReply[]>;
	deleteDeleteDocEntry(id: string): Promise<number>;
	tryClearTask(task: Task): Promise<number>;
	tryDeduplicateTask(task: Task, lastId: number, redisMinMessageLifetime: number): Promise<void>;
}
