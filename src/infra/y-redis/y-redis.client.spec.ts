import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import * as Awareness from 'y-protocols/awareness';
import * as Y from 'yjs';
import { Doc, encodeStateAsUpdateV2 } from 'yjs';
import { Logger } from '../logger/logger.js';
import { RedisAdapter } from '../redis/interfaces/index.js';
import { IoRedisAdapter } from '../redis/ioredis.adapter.js';
import { StorageService } from '../storage/storage.service.js';
import * as helper from './helper.js';
import * as protocol from './protocol.js';
import { DocumentStorage } from './storage.js';
import { streamMessagesReplyFactory } from './testing/stream-messages-reply.factory.js';
import { yRedisMessageFactory } from './testing/y-redis-message.factory.js';
import { YRedisClient } from './y-redis.client.js';

describe(YRedisClient.name, () => {
	let module: TestingModule;
	let redis: DeepMocked<RedisAdapter>;
	let store: DeepMocked<DocumentStorage>;
	let yRedisClient: YRedisClient;

	beforeEach(async () => {
		module = await Test.createTestingModule({
			providers: [
				{
					provide: YRedisClient,
					useFactory: (redisAdapter: RedisAdapter, storageService: StorageService, logger: Logger): YRedisClient => {
						const yRedisClient = new YRedisClient(storageService, redisAdapter, logger);

						return yRedisClient;
					},
					inject: [IoRedisAdapter, StorageService, Logger],
				},
				{
					provide: StorageService,
					useValue: createMock<DocumentStorage>(),
				},
				{
					provide: IoRedisAdapter,
					useValue: createMock<RedisAdapter>({
						redisPrefix: 'prefix',
					}),
				},
				{
					provide: Logger,
					useValue: createMock<Logger>(),
				},
			],
		}).compile();

		redis = module.get(IoRedisAdapter);
		store = module.get(StorageService);
		yRedisClient = module.get(YRedisClient);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('getMessages', () => {
		describe('when streams is empty', () => {
			it('should return empty array', async () => {
				const result = await yRedisClient.getMessages([]);

				expect(result).toEqual([]);
			});
		});

		describe('when streams is not empty', () => {
			const setup = () => {
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

				return { spyMergeMessages, expectedResult, expectedMessages, props };
			};

			it('should call redis.readStreams with correctly params', async () => {
				const { props } = setup();

				await yRedisClient.getMessages(props);

				expect(redis.readStreams).toHaveBeenCalledTimes(1);
				expect(redis.readStreams).toHaveBeenCalledWith(props);
			});

			it('should call protocol.mergeMessages with correctly values', async () => {
				const { spyMergeMessages, expectedMessages, props } = setup();

				await yRedisClient.getMessages(props);

				expect(spyMergeMessages).toHaveBeenCalledTimes(1);
				expect(spyMergeMessages).toHaveBeenCalledWith(expectedMessages);
			});

			it('should return expected messages', async () => {
				const { expectedResult, props } = setup();

				const result = await yRedisClient.getMessages(props);

				expect(result).toEqual(expectedResult);
			});
		});
	});

	describe('addMessage', () => {
		describe('when m is a sync step 2 message', () => {
			const setup = () => {
				const room = 'room';
				const docid = 'docid';
				const message = Buffer.from([protocol.messageSync, protocol.messageSyncStep2]);

				const props = { room, docid, message };

				return { props };
			};
			it('should return a promise', async () => {
				const { props } = setup();

				const result = await yRedisClient.addMessage(props.room, props.docid, props.message);

				expect(result).toBeUndefined();
				expect(redis.addMessage).not.toHaveBeenCalled();
			});
		});

		describe('when m is not a sync step 2 message', () => {
			const setup = () => {
				const room = 'room';
				const docid = 'docid';
				const message = Buffer.from([protocol.messageSync, protocol.messageSyncUpdate]);

				const props = { room, docid, message };

				return { props };
			};

			it('should call redis.addMessage with correctly params', async () => {
				const { props } = setup();

				await yRedisClient.addMessage(props.room, props.docid, props.message);

				expect(redis.addMessage).toHaveBeenCalledTimes(1);
				expect(redis.addMessage).toHaveBeenCalledWith('prefix:room:room:docid', props.message);
			});
		});

		describe('when m is correctly message', () => {
			const setup = () => {
				const room = 'room';
				const docid = 'docid';
				const message = Buffer.from([protocol.messageSync, protocol.messageSyncStep2, 0x54, 0x45, 0x53, 0x54]);

				const props = { room, docid, message };

				return { props };
			};
			it('should set correctly protocol type', async () => {
				const { props } = setup();

				await yRedisClient.addMessage(props.room, props.docid, props.message);

				expect(props.message[1]).toEqual(protocol.messageSyncUpdate);
			});
		});
	});

	describe('getStateVector', () => {
		const setup = () => {
			const room = 'room';
			const docid = 'docid';

			const props = { room, docid };

			return { props };
		};

		it('should call store.retrieveStateVector with correctly params', async () => {
			const { props } = setup();
			const { room, docid } = props;

			await yRedisClient.getStateVector(room, docid);

			expect(store.retrieveStateVector).toHaveBeenCalledTimes(1);
			expect(store.retrieveStateVector).toHaveBeenCalledWith(room, docid);
		});
	});

	describe('getDoc', () => {
		const setup = () => {
			const spyComputeRedisRoomStreamName = jest.spyOn(helper, 'computeRedisRoomStreamName');
			const spyExtractMessagesFromStreamReply = jest.spyOn(helper, 'extractMessagesFromStreamReply');

			const ydoc = new Doc();
			const doc = encodeStateAsUpdateV2(ydoc);
			const streamReply = streamMessagesReplyFactory.build();
			redis.readMessagesFromStream.mockResolvedValueOnce(streamReply);
			store.retrieveDoc.mockResolvedValueOnce({ doc, references: [] });

			const room = 'roomid-1';
			const docid = 'docid';

			const props = { room, docid };

			return {
				props,
				spyComputeRedisRoomStreamName,
				spyExtractMessagesFromStreamReply,
				streamReply,
			};
		};

		it('should call computeRedisRoomStreamName with correctly params', async () => {
			const { props, spyComputeRedisRoomStreamName } = setup();
			const { room, docid } = props;

			const result = await yRedisClient.getDoc(room, docid);
			result.awareness.destroy();

			expect(spyComputeRedisRoomStreamName).toHaveBeenCalledWith(room, docid, 'prefix');
		});

		it('should call redis.readMessagesFromStream with correctly params', async () => {
			const { props } = setup();
			const { room, docid } = props;

			const result = await yRedisClient.getDoc(room, docid);
			result.awareness.destroy();

			expect(redis.readMessagesFromStream).toHaveBeenCalledTimes(1);
			expect(redis.readMessagesFromStream).toHaveBeenCalledWith('prefix:room:roomid-1:docid');
		});

		it('should call extractMessagesFromStreamReply with correctly params', async () => {
			const { props, spyExtractMessagesFromStreamReply, streamReply } = setup();
			const { room, docid } = props;

			const result = await yRedisClient.getDoc(room, docid);
			result.awareness.destroy();

			expect(spyExtractMessagesFromStreamReply).toHaveBeenCalledWith(streamReply, 'prefix');
		});

		it('should return expected result', async () => {
			const { props } = setup();
			const { room, docid } = props;

			const result = await yRedisClient.getDoc(room, docid);
			result.awareness.destroy();

			expect(result).toBeDefined();
			expect(result).toEqual(expect.objectContaining({ ydoc: expect.any(Doc) }));
		});

		it('should return awarenessStateSize', async () => {
			const { props } = setup();
			const { room, docid } = props;

			const result = await yRedisClient.getDoc(room, docid);
			result.awareness.states.set(0, new Map());

			expect(result.getAwarenessStateSize()).toBe(1);
			result.awareness.destroy();
		});
	});

	describe('destroy', () => {
		const setup = () => {
			const callback = jest.fn();

			yRedisClient.registerDestroyedCallback(callback);

			return { callback };
		};

		it('should call store.destroy with correctly params', async () => {
			await yRedisClient.destroy();

			expect(redis.quit).toHaveBeenCalledTimes(1);
		});

		it('should call destroyedCallback', async () => {
			const { callback } = setup();

			await yRedisClient.destroy();

			expect(callback).toHaveBeenCalledTimes(1);
		});
	});

	describe('registerDestroyedCallback', () => {
		const setup = () => {
			const callback = jest.fn();

			return { callback };
		};

		it('should set the destroyedCallback correctly', () => {
			const { callback } = setup();

			yRedisClient.registerDestroyedCallback(callback);

			// @ts-ignore it is private method
			expect(yRedisClient.destroyedCallback).toBe(callback);
		});

		it('should call the destroyedCallback when destroy is called', async () => {
			const { callback } = setup();

			yRedisClient.registerDestroyedCallback(callback);
			await yRedisClient.destroy();

			expect(callback).toHaveBeenCalledTimes(1);
		});
	});

	describe('handleMessageUpdates', () => {
		describe('when a message is messageSyncUpdate', () => {
			const setup = () => {
				const ydoc = new Doc();
				const awareness = createMock<Awareness.Awareness>();
				const message = Buffer.from([protocol.messageSync, protocol.messageSyncUpdate, 0x54, 0x45, 0x53, 0x54]);

				const messages = yRedisMessageFactory.build({ messages: [message] });

				const spyApplyUpdate = jest.spyOn(Y, 'applyUpdate');
				spyApplyUpdate.mockReturnValueOnce(undefined);

				return { ydoc, awareness, messages, spyApplyUpdate };
			};

			it('should call Y.applyUpdate with correctly params', () => {
				const { ydoc, awareness, messages, spyApplyUpdate } = setup();

				// @ts-ignore it is private method
				yRedisClient.handleMessageUpdates(messages, ydoc, awareness);

				expect(spyApplyUpdate).toHaveBeenCalledWith(ydoc, expect.anything());
			});
		});

		describe('when a message is messageSyncAwareness', () => {
			const setup = () => {
				const ydoc = new Doc();
				const awareness = createMock<Awareness.Awareness>();
				const message = Buffer.from([protocol.messageAwareness, 0x54, 0x45, 0x53, 0x54]);

				const messages = yRedisMessageFactory.build({ messages: [message] });

				const spyApplyAwarenessUpdate = jest.spyOn(Awareness, 'applyAwarenessUpdate');
				spyApplyAwarenessUpdate.mockReturnValueOnce(undefined);

				return { ydoc, awareness, messages, spyApplyAwarenessUpdate };
			};

			it('should call Y.applyAwarenessUpdate with correctly params', () => {
				const { ydoc, awareness, messages, spyApplyAwarenessUpdate } = setup();

				// @ts-ignore it is private method
				yRedisClient.handleMessageUpdates(messages, ydoc, awareness);

				expect(spyApplyAwarenessUpdate).toHaveBeenCalledWith(awareness, expect.anything(), null);
			});
		});
	});
});
