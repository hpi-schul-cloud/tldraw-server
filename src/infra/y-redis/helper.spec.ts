import { streamMessagesReplyFactory } from '../redis/testing/stream-messages-reply.factory.js';
import {
	computeRedisRoomStreamName,
	decodeRedisRoomStreamName,
	extractMessagesFromStreamReply,
	isSmallerRedisId,
} from './helper.js';

describe('helper', () => {
	describe('isSmallerRedisId', () => {
		describe('when a1 is smaller than b1', () => {
			it('returns true', () => {
				const a = '1-1';
				const b = '2-1';

				const result = isSmallerRedisId(a, b);

				expect(result).toBe(true);
			});
		});

		describe('when a1 is greater than b1', () => {
			it('returns false', () => {
				const a = '2-1';
				const b = '1-1';

				const result = isSmallerRedisId(a, b);

				expect(result).toBe(false);
			});
		});

		describe('when a1 is equal to b1 and a2 is smaller than b2', () => {
			it('returns true', () => {
				const a = '1-1';
				const b = '1-2';

				const result = isSmallerRedisId(a, b);

				expect(result).toBe(true);
			});
		});

		describe('when a1 is equal to b1 and a2 is greater than b2', () => {
			it('returns false', () => {
				const a = '1-2';
				const b = '1-1';

				const result = isSmallerRedisId(a, b);

				expect(result).toBe(false);
			});
		});
	});

	describe('computeRedisRoomStreamName', () => {
		it('returns the expected value', () => {
			const room = 'room';
			const docid = 'docid';
			const prefix = 'prefix';

			const result = computeRedisRoomStreamName(room, docid, prefix);

			expect(result).toBe('prefix:room:room:docid');
		});
	});

	describe('decodeRedisRoomStreamName', () => {
		describe('when the rediskey is malformed', () => {
			it('throws an error', () => {
				const rediskey = 'invalid';
				const expectedPrefix = 'prefix';

				expect(() => decodeRedisRoomStreamName(rediskey, expectedPrefix)).toThrow(
					`Malformed stream name! prefix="undefined" expectedPrefix="prefix", rediskey="invalid"`,
				);
			});
		});

		describe('when the rediskey is well formed', () => {
			it('returns the expected values', () => {
				const rediskey = 'prefix:room:room:docid';
				const expectedPrefix = 'prefix';

				const result = decodeRedisRoomStreamName(rediskey, expectedPrefix);

				expect(result).toEqual({ room: 'room', docid: 'docid' });
			});
		});

		describe('when the prefix does not match', () => {
			it('throws an error', () => {
				const rediskey = 'invalid:room:room:docid';
				const expectedPrefix = 'prefix';

				expect(() => decodeRedisRoomStreamName(rediskey, expectedPrefix)).toThrow(
					`Malformed stream name! prefix="invalid" expectedPrefix="prefix", rediskey="invalid:room:room:docid"`,
				);
			});
		});
	});

	describe('extractMessagesFromStreamReply', () => {
		it('returns the expected value', () => {
			const streamReply = streamMessagesReplyFactory.build();
			const prefix = 'prefix';

			const result = extractMessagesFromStreamReply(streamReply, prefix);

			expect(result).toEqual(
				new Map([
					[
						'roomid-1',
						new Map([
							[
								'docid',
								{
									lastId: 'redis-id-2',
									messages: [Buffer.from('message-1-2'), Buffer.from('message-2-2')],
								},
							],
						]),
					],
				]),
			);
		});
	});
});
