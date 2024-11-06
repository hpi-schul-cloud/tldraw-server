import { createMock } from '@golevelup/ts-jest';
import * as yjs from 'yjs';
import { RedisAdapter } from '../redis/redis.adapter.js';
import { Api } from './api.service.js';
import * as helper from './helper.js';
import * as protocol from './protocol.js';
import { DocumentStorage } from './storage.js';
import { streamsMessagesReplyFactory } from './testing/streams-messages-reply.factory.js';

describe(Api.name, () => {
	const setupApi = () => {
		const store = createMock<DocumentStorage>();
		const redis = createMock<RedisAdapter>({
			redisPrefix: 'prefix',
		});
		const api = new Api(store, redis);

		return { store, redis, api };
	};

	afterEach(() => {
		jest.resetAllMocks();
	});

	describe('getMessages', () => {
		describe('when streams is empty', () => {
			it('should return empty array', async () => {
				const { api } = setupApi();

				const result = await api.getMessages([]);

				expect(result).toEqual([]);
			});
		});

		describe('when streams is not empty', () => {
			const setup = () => {
				const { redis, api } = setupApi();

				const m = streamsMessagesReplyFactory.build();
				redis.readStreams.mockResolvedValueOnce(m);

				const props = [
					{
						key: 'stream1',
						id: '1',
					},
				];
				const spyMergeMessages = jest.spyOn(protocol, 'mergeMessages').mockReturnValueOnce([]);

				const { name, messages } = m[0];
				// @ts-ignore
				const lastId = messages[messages.length - 1].id;

				const expectedResult = [
					{
						lastId,
						messages: [],
						stream: name,
					},
				];

				const expectedMessages = messages?.map((message) => message.message.m).filter((m) => m != null);

				return { redis, api, spyMergeMessages, expectedResult, expectedMessages, props };
			};

			it('should call redis.readStreams with correctly params', async () => {
				const { api, redis, props } = setup();

				await api.getMessages(props);

				expect(redis.readStreams).toHaveBeenCalledTimes(1);
				expect(redis.readStreams).toHaveBeenCalledWith(props);
			});

			it('should call protocol.mergeMessages with correctly values', async () => {
				const { api, spyMergeMessages, expectedMessages, props } = setup();

				await api.getMessages(props);

				expect(spyMergeMessages).toHaveBeenCalledTimes(1);
				expect(spyMergeMessages).toHaveBeenCalledWith(expectedMessages);
			});

			it('should return expected messages', async () => {
				const { api, expectedResult, props } = setup();

				const result = await api.getMessages(props);

				expect(result).toEqual(expectedResult);
			});
		});
	});

	describe('addMessage', () => {
		describe('when m is a sync step 2 message', () => {
			const setup = () => {
				const { api, redis } = setupApi();

				const room = 'room';
				const docid = 'docid';
				const message = Buffer.from([protocol.messageSync, protocol.messageSyncStep2]);

				const props = { room, docid, message };

				return { api, redis, props };
			};
			it('should return a promise', async () => {
				const { api, redis, props } = setup();

				const result = await api.addMessage(props.room, props.docid, props.message);

				expect(result).toBeUndefined();
				expect(redis.addMessage).not.toHaveBeenCalled();
			});
		});

		describe('when m is not a sync step 2 message', () => {
			const setup = () => {
				const { api, redis } = setupApi();

				const room = 'room';
				const docid = 'docid';
				const message = Buffer.from([protocol.messageSync, protocol.messageSyncUpdate]);

				const props = { room, docid, message };

				return { api, redis, props };
			};

			it('should call redis.addMessage with correctly params', async () => {
				const { api, redis, props } = setup();

				await api.addMessage(props.room, props.docid, props.message);

				expect(redis.addMessage).toHaveBeenCalledTimes(1);
				expect(redis.addMessage).toHaveBeenCalledWith('prefix:room:room:docid', props.message);
			});
		});

		describe('when m is correctly message', () => {
			const setup = () => {
				const { api } = setupApi();

				const room = 'room';
				const docid = 'docid';
				const message = Buffer.from([protocol.messageSync, protocol.messageSyncStep2, 0x54, 0x45, 0x53, 0x54]);

				const props = { room, docid, message };

				return { api, props };
			};
			it('should set correctly protocol type', async () => {
				const { api, props } = setup();

				await api.addMessage(props.room, props.docid, props.message);

				expect(props.message[1]).toEqual(protocol.messageSyncUpdate);
			});
		});
	});

	describe('getStateVector', () => {
		const setup = () => {
			const { api, store } = setupApi();

			const room = 'room';
			const docid = 'docid';

			const props = { room, docid };

			return { api, store, props };
		};

		it('should call store.retrieveStateVector with correctly params', async () => {
			const { api, store, props } = setup();
			const { room, docid } = props;

			await api.getStateVector(room, docid);

			expect(store.retrieveStateVector).toHaveBeenCalledTimes(1);
			expect(store.retrieveStateVector).toHaveBeenCalledWith(room, docid);
		});
	});

	describe('getDoc', () => {
		const setup = () => {
			const { api, store } = setupApi();
			const spyComputeRedisRoomStreamName = jest.spyOn(helper, 'computeRedisRoomStreamName');
			const spyExtractMessagesFromStreamReply = jest.spyOn(helper, 'extractMessagesFromStreamReply');
			//const spyAwareness = jest.spyOn(awareness, 'Awareness');
			//const spyDoc = jest.spyOn(yjs, 'Doc');
			const spyApplyUpdateV2 = jest.spyOn(yjs, 'applyUpdateV2');
			const room = 'room';
			const docid = 'docid';

			const props = { room, docid };

			return {
				api,
				store,
				props,
				spyComputeRedisRoomStreamName,
				spyExtractMessagesFromStreamReply,
				//spyAwareness,
				spyApplyUpdateV2,
			};
		};

		it('should call computeRedisRoomStreamName with correctly params', async () => {
			const { api, props } = setup();
			const { room, docid } = props;

			await api.getDoc(room, docid);

			//expect(spyComputeRedisRoomStreamName).toHaveBeenCalledTimes(1);
		});
	});

	describe('destroy', () => {
		const setup = () => {
			const { api, redis } = setupApi();

			return { api, redis };
		};

		it('should call store.destroy with correctly params', async () => {
			const { api, redis } = setup();

			await api.destroy();

			expect(redis.quit).toHaveBeenCalledTimes(1);
		});
	});
});
