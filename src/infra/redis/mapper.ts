import { RedisKey } from 'ioredis';
import { TypeGuard } from './guards/index.js';
import { checkXItems, XAutoClaimResponse, XItem, XItems, XReadBufferReply } from './interfaces/redis.interface.js';
import { StreamMessageReply, StreamsMessagesReply } from './interfaces/stream-message-replay.js';

export function mapToXAutoClaimResponse(value: unknown): XAutoClaimResponse {
	if (value === null || value === undefined) {
		// Is this correct or should there also be an error thrown?
		return { nextId: '', messages: null };
	}

	const unknownArray = TypeGuard.checkUnknownArrayWithElements(value);
	const xItems = checkXItems(unknownArray[1]);
	const redisKey = TypeGuard.isString(unknownArray[0])
		? TypeGuard.checkString(unknownArray[0])
		: TypeGuard.checkBuffer(unknownArray[0]);

	return {
		nextId: redisKey,
		messages: mapToStreamMessagesReplies(xItems),
	};
}

export function mapToStreamMessagesReplies(messages: XItems): StreamMessageReply[] {
	if (messages === null) {
		return [];
	}

	const result = messages.map((value) => {
		return mapToStreamMessageReply(value);
	});

	return result;
}

export function mapToStreamsMessagesReply(streamReply: XReadBufferReply): StreamsMessagesReply {
	if (streamReply === null) {
		return [];
	}

	const result = streamReply.map(([name, messages]) => {
		return {
			name: name.toString(),
			messages: mapToStreamMessagesReplies(messages),
		};
	});

	return result;
}

export function mapToStreamMessageReply(value: XItem): StreamMessageReply {
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
