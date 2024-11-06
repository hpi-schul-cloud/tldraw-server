import { Task, XAutoClaimResponse } from './redis.interface.js';
import { StreamMessageReply, StreamsMessagesReply } from './stream-message-reply.js';
import { StreamNameClockPair } from './stream-name-clock-pair.js';

export interface RedisAdapter {
	readonly redisPrefix: string;
	subscribeToDeleteChannel(callback: (message: string) => void): void;
	markToDeleteByDocName(docName: string): Promise<void>;
	addMessage(key: string, message: unknown): Promise<void>;
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
