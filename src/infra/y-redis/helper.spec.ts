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
			const prefix = 'y';

			const result = computeRedisRoomStreamName(room, docid, prefix);

			expect(result).toBe('y:room:room:docid');
		});
	});

	describe('decodeRedisRoomStreamName', () => {
		describe('when the rediskey is malformed', () => {
			it('throws an error', () => {
				const rediskey = 'invalid';
				const expectedPrefix = 'y';

				expect(() => decodeRedisRoomStreamName(rediskey, expectedPrefix)).toThrow(
					`Malformed stream name! expectedRedisPrefix="y", rediskey="invalid"`,
				);
			});
		});

		describe('when the rediskey is well formed', () => {
			it('returns the expected values', () => {
				const rediskey = 'y:room:room:docid';
				const expectedPrefix = 'y';

				const result = decodeRedisRoomStreamName(rediskey, expectedPrefix);

				expect(result).toEqual({ room: 'room', docid: 'docid' });
			});
		});

		describe('when the prefix does not match', () => {
			it('throws an error', () => {
				const rediskey = 'invalid:room:room:docid';
				const expectedPrefix = 'y';

				expect(() => decodeRedisRoomStreamName(rediskey, expectedPrefix)).toThrow(
					`Malformed stream name! expectedRedisPrefix="y", rediskey="invalid:room:room:docid"`,
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
