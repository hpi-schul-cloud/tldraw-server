import { RedisKey } from 'ioredis';
import { StreamMessageReply } from './stream-message-replay.js';

export type XItem = [id: Buffer, fields: Buffer[]];

export const isXItem = (value: unknown): value is XItem => {
	if (!Array.isArray(value) || value.length !== 2) {
		return false;
	}

	const [id, fields] = value;

	const isBuffer = Buffer.isBuffer(id) && Array.isArray(fields) && fields.every(Buffer.isBuffer);

	return isBuffer;
};

export const checkXItem = (value: unknown): XItem => {
	if (!isXItem(value)) {
		throw new Error('Value is not a XItem');
	}

	return value;
};

export type XItems = XItem[];

export const isXItems = (value: unknown): value is XItems => {
	if (!Array.isArray(value)) {
		return false;
	}

	return value.every(isXItem);
};

export const checkXItems = (value: unknown): XItems => {
	if (!isXItems(value)) {
		throw new Error('Value is not a XItems');
	}

	return value;
};

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
