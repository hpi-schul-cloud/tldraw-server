import { array, map } from 'lib0';
import { StreamMessagesReply } from '../redis/interfaces/stream-message-reply.js';
import { YRedisMessage } from './interfaces/stream-message.js';

/* This file contains the implementation of the functions,
    which was copied from the y-redis repository.
	Adopting this code allows us to integrate proven and
	optimized logic into the current project.
	The original code from the `y-redis` repository is licensed under the AGPL-3.0 license.
	By adhering to the license terms, we ensure that the use of the code from the `y-redis` repository is legally compliant.
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

export const decodeRedisRoomStreamName = (rediskey: string, expectedPrefix: string) => {
	const match = rediskey.match(/^(.*):room:(.*):(.*)$/);
	if (match == null || match[1] !== expectedPrefix) {
		throw new Error(
			`Malformed stream name! prefix="${match?.[1]}" expectedPrefix="${expectedPrefix}", rediskey="${rediskey}"`,
		);
	}

	return { room: decodeURIComponent(match[2]), docid: decodeURIComponent(match[3]) };
};

export const extractMessagesFromStreamReply = (
	streamReply: StreamMessagesReply,
	prefix: string,
): Map<string, Map<string, YRedisMessage>> => {
	const messages = new Map<string, Map<string, YRedisMessage>>();

	streamReply?.forEach((docStreamReply) => {
		const { room, docid } = decodeRedisRoomStreamName(docStreamReply.name.toString(), prefix);
		const docMessages = map.setIfUndefined(map.setIfUndefined(messages, room, map.create), docid, () => ({
			// @ts-ignore
			lastId: array.last(docStreamReply.messages).id,
			messages: [] as Uint8Array[],
		}));
		docStreamReply.messages?.forEach((m) => {
			if (m.message.m != null) {
				// @ts-ignore
				docMessages.messages.push(m.message.m);
			}
		});
	});

	return messages;
};
