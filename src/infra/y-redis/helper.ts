import { RedisKey } from 'ioredis';
import { array, map } from 'lib0';
import { StreamMessageReply, StreamMessagesReply, TypeGuard } from '../../infra/redis/index.js';
import { YRedisMessage } from './interfaces/stream-message.js';

/* This file contains the implementation of the functions,
    which was copied from the y-redis repository.
	Adopting this code allows us to integrate proven and
	optimized logic into the current project.
	The original code from the `y-redis` repository is licensed under the AGPL-3.0 license.
	https://github.com/yjs/y-redis
*/
export const isSmallerRedisId = (a: string, b: string): boolean => {
	const [a1, a2 = '0'] = a.split('-');
	const [b1, b2 = '0'] = b.split('-');
	const a1n = parseInt(a1);
	const b1n = parseInt(b1);

	return a1n < b1n || (a1n === b1n && parseInt(a2) < parseInt(b2));
};

export const computeRedisRoomStreamName = (room: string, docid: string, prefix: string): string =>
	`${prefix}:room:${encodeURIComponent(room)}:${encodeURIComponent(docid)}`;

export interface RoomStreamInfos {
	room: string;
	docid: string;
}

export const decodeRedisRoomStreamName = (rediskey: string, expectedRedisPrefix: string): RoomStreamInfos => {
	const match = new RegExp(`^${expectedRedisPrefix}:room:([^:]+):([^:]+)$`).exec(rediskey);

	if (match == null) {
		throw new Error(`Malformed stream name! expectedRedisPrefix="${expectedRedisPrefix}", rediskey="${rediskey}"`);
	}

	return { room: decodeURIComponent(match[1]), docid: decodeURIComponent(match[2]) };
};

const getIdFromLastStreamMessageReply = (docStreamReplay: StreamMessagesReply): RedisKey | undefined => {
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
	streamReply: StreamMessagesReply[],
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
			if ('m' in m.message && m.message.m != null) {
				const unit8ArrayRedisKey = castRedisKeyToUnit8Array(m.message.m);
				docMessages.messages.push(unit8ArrayRedisKey);
			}
		});
	});

	return messages;
};
