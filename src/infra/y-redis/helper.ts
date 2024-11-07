import { RedisKey } from 'ioredis';
import { array, map } from 'lib0';
import { TypeGuard } from '../../infra/redis/guards/type.guard.js';
import {
	StreamMessageReply,
	StreamMessagesReply,
	StreamMessagesSingleReply,
} from '../../infra/redis/interfaces/stream-message-reply.js';
import { YRedisMessage } from './interfaces/stream-message.js';

export const isSmallerRedisId = (a: string, b: string): boolean => {
	const [a1, a2 = '0'] = a.split('-');
	const [b1, b2 = '0'] = b.split('-');
	const a1n = parseInt(a1);
	const b1n = parseInt(b1);

	return a1n < b1n || (a1n === b1n && parseInt(a2) < parseInt(b2));
};

export const computeRedisRoomStreamName = (room: string, docid: string, prefix: string): string =>
	`${prefix}:room:${encodeURIComponent(room)}:${encodeURIComponent(docid)}`;

export const decodeRedisRoomStreamName = (
	rediskey: string,
	expectedPrefix: string,
): { room: string; docid: string } => {
	const match = rediskey.match(/^(.*):room:(.*):(.*)$/);
	if (match == null || match[1] !== expectedPrefix) {
		throw new Error(
			`Malformed stream name! prefix="${match?.[1]}" expectedPrefix="${expectedPrefix}", rediskey="${rediskey}"`,
		);
	}

	return { room: decodeURIComponent(match[2]), docid: decodeURIComponent(match[3]) };
};

const getIdFromLastStreamMessageReply = (docStreamReplay: StreamMessagesSingleReply): RedisKey | undefined => {
	let id = undefined;
	if (TypeGuard.isArrayWithElements(docStreamReplay.messages)) {
		id = array.last(docStreamReplay.messages).id;
	}

	return id;
};

const castRedisKeyToUnit8Array = (redisKey: RedisKey): Uint8Array => {
	// Be carful the redis key do not include any of the Unit8Array methods.
	const castedRedisKey = redisKey as Uint8Array;

	return castedRedisKey;
};

export const extractMessagesFromStreamReply = (
	streamReply: StreamMessagesReply,
	prefix: string,
): Map<string, Map<string, YRedisMessage>> => {
	const messages = new Map<string, Map<string, YRedisMessage>>();

	streamReply?.forEach((docStreamReply) => {
		const { room, docid } = decodeRedisRoomStreamName(docStreamReply.name.toString(), prefix);
		const docMessages = map.setIfUndefined(map.setIfUndefined(messages, room, map.create), docid, () => ({
			lastId: getIdFromLastStreamMessageReply(docStreamReply),
			messages: [] as Uint8Array[],
		}));
		docStreamReply.messages?.forEach((m: StreamMessageReply) => {
			if (m.message.m != null) {
				const unit8ArrayRedisKey = castRedisKeyToUnit8Array(m.message.m);
				docMessages.messages.push(unit8ArrayRedisKey);
			}
		});
	});

	return messages;
};
