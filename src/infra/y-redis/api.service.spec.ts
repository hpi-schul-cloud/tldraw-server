import { createMock } from '@golevelup/ts-jest';
import * as Awareness from 'y-protocols/awareness';
import * as Y from 'yjs';
import { RedisService } from '../../infra/redis/redis.service.js';
import { RedisAdapter } from '../redis/interfaces/index.js';
import { Api, createApiClient, handleMessageUpdates } from './api.service.js';
import * as helper from './helper.js';
import * as protocol from './protocol.js';
import { DocumentStorage } from './storage.js';
import { streamMessagesReplyFactory } from './testing/stream-messages-reply.factory.js';
import { yRedisMessageFactory } from './testing/y-redis-message.factory.js';

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
		jest.restoreAllMocks();
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

				const m = streamMessagesReplyFactory.build();
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
			const { api, store, redis } = setupApi();
			const spyComputeRedisRoomStreamName = jest.spyOn(helper, 'computeRedisRoomStreamName');
			const spyExtractMessagesFromStreamReply = jest.spyOn(helper, 'extractMessagesFromStreamReply');

			const ydoc = new Y.Doc();
			const doc = Y.encodeStateAsUpdateV2(ydoc);
			const streamReply = streamMessagesReplyFactory.build();
			redis.readMessagesFromStream.mockResolvedValueOnce(streamReply);
			store.retrieveDoc.mockResolvedValueOnce({ doc, references: [] });

			const room = 'roomid-1';
			const docid = 'docid';

			const props = { room, docid };

			return {
				api,
				store,
				redis,
				props,
				spyComputeRedisRoomStreamName,
				spyExtractMessagesFromStreamReply,
				streamReply,
			};
		};

		it('should call computeRedisRoomStreamName with correctly params', async () => {
			const { api, props, spyComputeRedisRoomStreamName } = setup();
			const { room, docid } = props;

			const result = await api.getDoc(room, docid);
			result.awareness.destroy();

			expect(spyComputeRedisRoomStreamName).toHaveBeenCalledWith(room, docid, 'prefix');
		});

		it('should call redis.readMessagesFromStream with correctly params', async () => {
			const { api, props, redis } = setup();
			const { room, docid } = props;

			const result = await api.getDoc(room, docid);
			result.awareness.destroy();

			expect(redis.readMessagesFromStream).toHaveBeenCalledTimes(1);
			expect(redis.readMessagesFromStream).toHaveBeenCalledWith('prefix:room:roomid-1:docid');
		});

		it('should call extractMessagesFromStreamReply with correctly params', async () => {
			const { api, props, spyExtractMessagesFromStreamReply, streamReply } = setup();
			const { room, docid } = props;

			const result = await api.getDoc(room, docid);
			result.awareness.destroy();

			expect(spyExtractMessagesFromStreamReply).toHaveBeenCalledWith(streamReply, 'prefix');
		});

		it('should return expected result', async () => {
			const { api, props } = setup();
			const { room, docid } = props;

			const result = await api.getDoc(room, docid);
			result.awareness.destroy();

			expect(result).toBeDefined();
			expect(result).toEqual(expect.objectContaining({ ydoc: expect.any(Y.Doc) }));
		});
	});

	describe('destroy', () => {
		const setup = () => {
			const { api, redis } = setupApi();

			return { api, redis };
		};

		it('should set _destroyed to true', () => {
			const { api } = setup();

			api.destroy();

			expect(api._destroyed).toBeTruthy();
		});

		it('should call store.destroy with correctly params', async () => {
			const { api, redis } = setup();

			await api.destroy();

			expect(redis.quit).toHaveBeenCalledTimes(1);
		});
	});
});

describe('handleMessageUpdates', () => {
	describe('when a message is messageSyncUpdate', () => {
		const setup = () => {
			const ydoc = new Y.Doc();
			const awareness = createMock<Awareness.Awareness>();
			const message = Buffer.from([protocol.messageSync, protocol.messageSyncUpdate, 0x54, 0x45, 0x53, 0x54]);

			const messages = yRedisMessageFactory.build({ messages: [message] });

			const spyApplyUpdate = jest.spyOn(Y, 'applyUpdate');
			spyApplyUpdate.mockReturnValueOnce(undefined);

			return { ydoc, awareness, messages, spyApplyUpdate };
		};

		it('should call Y.applyUpdate with correctly params', () => {
			const { ydoc, awareness, messages, spyApplyUpdate } = setup();

			handleMessageUpdates(messages, ydoc, awareness);

			expect(spyApplyUpdate).toHaveBeenCalledWith(ydoc, expect.anything());
		});
	});

	describe('when a message is messageSyncAwareness', () => {
		const setup = () => {
			const ydoc = new Y.Doc();
			const awareness = createMock<Awareness.Awareness>();
			const message = Buffer.from([protocol.messageAwareness, 0x54, 0x45, 0x53, 0x54]);

			const messages = yRedisMessageFactory.build({ messages: [message] });

			const spyApplyAwarenessUpdate = jest.spyOn(Awareness, 'applyAwarenessUpdate');
			spyApplyAwarenessUpdate.mockReturnValueOnce(undefined);

			return { ydoc, awareness, messages, spyApplyAwarenessUpdate };
		};

		it('should call Y.applyAwarenessUpdate with correctly params', () => {
			const { ydoc, awareness, messages, spyApplyAwarenessUpdate } = setup();

			handleMessageUpdates(messages, ydoc, awareness);

			expect(spyApplyAwarenessUpdate).toHaveBeenCalledWith(awareness, expect.anything(), null);
		});
	});
});

describe('createApiClient', () => {
	const setup = () => {
		const store = createMock<DocumentStorage>();
		const redisService = createMock<RedisService>();
		const redisInstance = createMock<RedisAdapter>();
		const apiInstance = createMock<Api>({
			redis: redisInstance,
		});

		return { store, redisService, redisInstance, apiInstance };
	};

	it('should call createRedisInstance.createRedisInstance', async () => {
		const { store, redisService } = setup();

		await createApiClient(store, redisService);

		expect(redisService.createRedisInstance).toHaveBeenCalledTimes(1);
	});

	it('should return an instance of Api', async () => {
		const { store, redisService } = setup();

		const result = await createApiClient(store, redisService);

		expect(result).toBeDefined();
		expect(result).toBeInstanceOf(Api);
	});
});
