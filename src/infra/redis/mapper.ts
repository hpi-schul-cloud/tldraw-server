import { RedisGuard, TypeGuard } from './guards/index.js';
import {
	Compact,
	DocName,
	M,
	StreamMessageReply,
	StreamMessagesReply,
	XAutoClaimResponse,
	XItem,
	XItems,
	XReadBufferReply,
} from './interfaces/index.js';

export function mapToXAutoClaimResponse(value: unknown): XAutoClaimResponse {
	if (value === null || value === undefined) {
		// Is this correct or should there also be an error thrown?
		return { nextId: '', messages: null };
	}

	const unknownArray = TypeGuard.checkUnknownArrayWithElements(value);
	const xItems = RedisGuard.checkXItems(unknownArray[1]);
	const redisKey = TypeGuard.isString(unknownArray[0])
		? TypeGuard.checkString(unknownArray[0])
		: TypeGuard.checkBuffer(unknownArray[0]);

	return {
		nextId: redisKey,
		messages: mapToStreamMessagesReplies(xItems),
	};
}

export function mapToStreamMessagesReplies(messages: XItems | unknown): StreamMessageReply[] {
	if (messages === null) {
		return [];
	}

	const unknownArray = TypeGuard.checkArray(messages);
	const xItems = RedisGuard.checkXItems(unknownArray);

	const result = xItems.map((value) => {
		return mapToStreamMessageReply(value);
	});

	return result;
}

export function mapToStreamMessagesReply(streamReply: XReadBufferReply | unknown): StreamMessagesReply[] {
	if (streamReply === null) {
		return [];
	}

	const unknownArray = TypeGuard.checkUnknownArrayWithElements(streamReply);

	const result = unknownArray.map((entry) => {
		const entryArray = TypeGuard.checkUnknownArrayWithElements(entry);
		const key = TypeGuard.checkBuffer(entryArray[0]);
		const messages = RedisGuard.checkXItems(entryArray[1]);

		return {
			name: key.toString(),
			messages: mapToStreamMessagesReplies(messages),
		};
	});

	return result;
}

function mapToStreamMessageReply(value: XItem): StreamMessageReply {
	const [id, fields] = value;

	return { id: id.toString(), message: transformTuplesReply(fields) };
}

function transformTuplesReply(reply: string[] | Buffer[]): M | DocName | Compact {
	const message = Object.create(null);

	for (let i = 0; i < reply.length; i += 2) {
		message[reply[i].toString()] = reply[i + 1];
	}

	return message;
}
