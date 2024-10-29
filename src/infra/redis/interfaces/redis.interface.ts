import { RedisKey } from 'ioredis';
import { StreamMessageReply } from './stream-message-replay.js';

export type XItem = [id: Buffer | string, fields: Buffer[] | string[]];

export type XItems = XItem[];

export type XReadBufferReply = [key: Buffer, items: XItems][] | null;

export type XRangeResponse = [id: string, fields: string[]][];

export interface XAutoClaimResponse {
	nextId: RedisKey;
	messages: StreamMessageReply[] | null;
}

export interface Task {
	stream: RedisKey;
	id: string;
}
