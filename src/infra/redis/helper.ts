import { RedisKey } from 'ioredis';
import { XAutoClaimRawReply, XAutoClaimResponse, XItem, XItems } from './interfaces/redis.interface.js';
import { StreamMessageReply } from './interfaces/stream-message-replay.js';

export function transformXAutoClaimReply(reply: XAutoClaimRawReply): XAutoClaimResponse {
	if (reply === null) {
		return { nextId: '', messages: null };
	}

	return {
		nextId: reply[0],
		messages: transformStreamMessagesReply(reply[1]),
	};
}

export function transformStreamMessagesReply(messages: XItems): StreamMessageReply[] {
	if (messages === null) {
		return [];
	}

	const result = messages.map((value) => {
		return transformStreamMessageReply(value);
	});

	return result;
}

export function transformStreamMessageReply(value: XItem): StreamMessageReply {
	const [id, fields] = value;

	return { id: id.toString(), message: transformTuplesReply(fields) };
}

export function transformTuplesReply(reply: RedisKey[]): Record<string, RedisKey> {
	const message: Record<string, RedisKey> = Object.create(null);

	for (let i = 0; i < reply.length; i += 2) {
		message[reply[i].toString()] = reply[i + 1];
	}

	return message;
}
