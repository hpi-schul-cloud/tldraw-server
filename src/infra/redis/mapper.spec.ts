import { mapToStreamMessagesReplies, mapToStreamsMessagesReply, mapToXAutoClaimResponse } from './mapper.js';
import { xItemBufferFactory, xItemStringFactory } from './testing/x-item.factory.js';
import { xReadBufferReplyFactory } from './testing/x-read-buffer-reply.factory.js';

describe('Mapper', () => {
	describe('mapToXAutoClaimResponse', () => {
		describe('when value is null', () => {
			it('returns nextId as empty string and messages as null', () => {
				const value = null;

				const result = mapToXAutoClaimResponse(value);

				expect(result).toStrictEqual({ nextId: '', messages: null });
			});
		});

		describe('when value is undefined', () => {
			it('returns nextId as empty string and messages as null', () => {
				const value = undefined;

				const result = mapToXAutoClaimResponse(value);

				expect(result).toStrictEqual({ nextId: '', messages: null });
			});
		});

		describe('when value is object', () => {
			it('throws error', () => {
				const value = {};
				const error = new Error('Type is not an array with elements.');

				expect(() => mapToXAutoClaimResponse(value)).toThrow(error);
			});
		});

		describe('when value is string', () => {
			it('throws error', () => {
				const value = 'string';
				const error = new Error('Type is not an array with elements.');

				expect(() => mapToXAutoClaimResponse(value)).toThrow(error);
			});
		});

		describe('when value is number', () => {
			it('throws error', () => {
				const value = 1;
				const error = new Error('Type is not an array with elements.');

				expect(() => mapToXAutoClaimResponse(value)).toThrow(error);
			});
		});

		describe('when value is empty array', () => {
			it('throws error', () => {
				const value: [] = [];
				const error = new Error('Type is not an array with elements.');

				expect(() => mapToXAutoClaimResponse(value)).toThrow(error);
			});
		});

		describe('when redisKey is number', () => {
			it('throws error', () => {
				const value = [1, []];
				const error = new Error('Type is not a buffer.');

				expect(() => mapToXAutoClaimResponse(value)).toThrow(error);
			});
		});

		describe('when redisKey and XItem is string', () => {
			it('returns nextId as string and messages as array', () => {
				const value = ['string', 'string'];
				const error = new Error('Value is not a XItems');

				expect(() => mapToXAutoClaimResponse(value)).toThrow(error);
			});
		});

		describe('when redisKey is string and XItem is empty array', () => {
			it('returns nextId as string and messages as array', () => {
				const value = ['string', []];

				const result = mapToXAutoClaimResponse(value);

				expect(result).toStrictEqual({ nextId: 'string', messages: [] });
			});
		});

		describe('when redisKey is string and XItem is array with several string elements', () => {
			const setup = () => {
				const xItem1 = xItemStringFactory.build();
				const xItem2 = xItemStringFactory.build();

				const value = ['string', [xItem1, xItem2]];

				const key1 = xItem1[1][0].toString();
				const message1 = xItem1[1][1].toString();
				const key2 = xItem2[1][0].toString();
				const message2 = xItem2[1][1].toString();

				return { xItem1, xItem2, value, key1, message1, key2, message2 };
			};

			it('returns nextId as string and messages as array', () => {
				const { xItem1, xItem2, value, key1, message1, key2, message2 } = setup();

				const result = mapToXAutoClaimResponse(value);

				expect(result).toEqual({
					nextId: 'string',
					messages: [
						{ id: xItem1[0], message: { [key1]: message1 } },
						{ id: xItem2[0], message: { [key2]: message2 } },
					],
				});
			});
		});

		describe('when redisKey is buffer and XItem is array with several string elements', () => {
			const setup = () => {
				const xItem1 = xItemStringFactory.build();
				const xItem2 = xItemStringFactory.build();
				const bufferId = Buffer.from('buffer');

				const value = [bufferId, [xItem1, xItem2]];

				const key1 = xItem1[1][0].toString();
				const message1 = xItem1[1][1].toString();
				const key2 = xItem2[1][0].toString();
				const message2 = xItem2[1][1].toString();

				return { xItem1, xItem2, value, bufferId, key1, message1, key2, message2 };
			};

			it('returns nextId as string and messages as array', () => {
				const { xItem1, xItem2, value, bufferId, key1, message1, key2, message2 } = setup();

				const result = mapToXAutoClaimResponse(value);

				expect(result).toEqual({
					nextId: bufferId,
					messages: [
						{ id: xItem1[0], message: { [key1]: message1 } },
						{ id: xItem2[0], message: { [key2]: message2 } },
					],
				});
			});
		});

		describe('when redisKey is buffer and XItem is array with several buffer elements', () => {
			const setup = () => {
				const xItem1 = xItemBufferFactory.build();
				const xItem2 = xItemBufferFactory.build();
				const bufferId = Buffer.from('buffer');

				const value = [bufferId, [xItem1, xItem2]];

				const key1 = xItem1[1][0].toString();
				const message1 = xItem1[1][1];
				const key2 = xItem2[1][0].toString();
				const message2 = xItem2[1][1];

				return { xItem1, xItem2, value, bufferId, key1, message1, key2, message2 };
			};

			it('returns nextId as string and messages as array', () => {
				const { xItem1, xItem2, value, bufferId, key1, message1, key2, message2 } = setup();

				const result = mapToXAutoClaimResponse(value);

				expect(result).toEqual({
					nextId: bufferId,
					messages: [
						{ id: xItem1[0].toString(), message: { [key1]: message1 } },
						{ id: xItem2[0].toString(), message: { [key2]: message2 } },
					],
				});
			});
		});
	});

	describe('mapToStreamMessagesReplies', () => {
		describe('when messages is null', () => {
			it('returns empty array', () => {
				const messages = null;

				const result = mapToStreamMessagesReplies(messages);

				expect(result).toStrictEqual([]);
			});
		});

		describe('when messages is undefined', () => {
			it('throws error', () => {
				const messages = undefined;
				const error = new Error('Type is not an array.');

				expect(() => mapToStreamMessagesReplies(messages)).toThrow(error);
			});
		});

		describe('when messages is empty array', () => {
			it('returns empty array', () => {
				const messages: [] = [];

				const result = mapToStreamMessagesReplies(messages);

				expect(result).toStrictEqual([]);
			});
		});

		describe('when messages is array with one ivalid XItem', () => {
			const setup = () => {
				const xItem1 = xItemStringFactory.build();
				const xItem2 = 'invalid';

				const messages = [xItem1, xItem2];

				return { messages };
			};

			it('returns array with messages', () => {
				const { messages } = setup();
				const error = new Error('Value is not a XItems');

				expect(() => mapToStreamMessagesReplies(messages)).toThrow(error);
			});
		});

		describe('when messages is array with valid XItems', () => {
			const setup = () => {
				const xItem1 = xItemStringFactory.build();
				const xItem2 = xItemStringFactory.build();

				const messages = [xItem1, xItem2];

				const key1 = xItem1[1][0].toString();
				const message1 = xItem1[1][1].toString();
				const key2 = xItem2[1][0].toString();
				const message2 = xItem2[1][1].toString();

				return { xItem1, xItem2, messages, key1, message1, key2, message2 };
			};

			it('returns array with messages', () => {
				const { xItem1, xItem2, messages, key1, message1, key2, message2 } = setup();

				const result = mapToStreamMessagesReplies(messages);

				expect(result).toEqual([
					{ id: xItem1[0], message: { [key1]: message1 } },
					{ id: xItem2[0], message: { [key2]: message2 } },
				]);
			});
		});
	});

	describe('mapToStreamsMessagesReply', () => {
		describe('when streamReply is null', () => {
			it('returns empty array', () => {
				const streamReply = null;

				const result = mapToStreamsMessagesReply(streamReply);

				expect(result).toStrictEqual([]);
			});
		});

		describe('when streamReply is undefined', () => {
			it('throws error', () => {
				const streamReply = undefined;
				const error = new Error('Type is not an array with elements.');

				expect(() => mapToStreamsMessagesReply(streamReply)).toThrow(error);
			});
		});

		describe('when streamReply is empty array', () => {
			it('returns empty array', () => {
				const streamReply: [] = [];

				const error = new Error('Type is not an array with elements.');

				expect(() => mapToStreamsMessagesReply(streamReply)).toThrow(error);
			});
		});

		describe('when streamReply is valid XReadBufferReply', () => {
			const setup = () => {
				const streamReply = xReadBufferReplyFactory.build();

				if (streamReply === null) {
					throw new Error('streamReply is null');
				}

				const key = streamReply[0].toString();

				const streamsMessagesReply = mapToStreamMessagesReplies(streamReply[0][1]);

				return { streamReply, key, streamsMessagesReply };
			};

			it('returns array with messages', () => {
				const { streamReply, key, streamsMessagesReply } = setup();

				const result = mapToStreamsMessagesReply(streamReply);

				expect(result).toEqual([{ name: key[0], messages: streamsMessagesReply }]);
			});
		});
	});
});
