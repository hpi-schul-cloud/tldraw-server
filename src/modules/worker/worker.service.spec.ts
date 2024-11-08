import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { Awareness } from 'y-protocols/awareness.js';
import { Doc } from 'yjs';
import { Logger } from '../../infra/logger/logger.js';
import { RedisAdapter } from '../../infra/redis/interfaces/redis-adapter.js';
import { RedisService } from '../../infra/redis/redis.service.js';
import {
	streamMessageReplyFactory,
	xAutoClaimResponseFactory,
} from '../../infra/redis/testing/x-auto-claim-response.factory.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import * as apiClass from '../../infra/y-redis/api.service.js';
import { Api } from '../../infra/y-redis/api.service.js';
import { WorkerConfig } from './worker.config.js';
import { WorkerService } from './worker.service.js';

describe(WorkerService.name, () => {
	let service: WorkerService;
	let redisService: DeepMocked<RedisService>;

	beforeAll(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				WorkerService,
				{
					provide: StorageService,
					useValue: createMock<StorageService>(),
				},
				{
					provide: RedisService,
					useValue: createMock<RedisService>(),
				},
				{
					provide: Logger,
					useValue: createMock<Logger>(),
				},
				{
					provide: WorkerConfig,
					useValue: {
						WORKER_TRY_CLAIM_COUNT: 1,
						WORKER_TASK_DEBOUNCE: 1,
						WORKER_MIN_MESSAGE_LIFETIME: 1,
					},
				},
			],
		}).compile();

		service = await module.resolve(WorkerService);
		redisService = module.get(RedisService);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('onModuleInit', () => {
		describe('when _destroyed is false', () => {
			const setup = () => {
				const client = createMock<Api>({ _destroyed: false });
				jest.spyOn(apiClass, 'createApiClient').mockResolvedValueOnce(client);

				const error = new Error('Error to break while loop!');

				const consumeWorkerQueueSpy = jest.spyOn(service, 'consumeWorkerQueue').mockRejectedValueOnce(error);

				return { error, consumeWorkerQueueSpy };
			};

			it('should call consumeWorkerQueue', async () => {
				const { error, consumeWorkerQueueSpy } = setup();

				await expect(service.onModuleInit()).rejects.toThrow(error);

				expect(consumeWorkerQueueSpy).toHaveBeenCalled();
			});
		});

		describe('when _destroyed is true', () => {
			const setup = () => {
				const client = createMock<Api>({ _destroyed: true });
				jest.spyOn(apiClass, 'createApiClient').mockResolvedValueOnce(client);

				const consumeWorkerQueueSpy = jest.spyOn(service, 'consumeWorkerQueue').mockResolvedValueOnce([]);

				return { consumeWorkerQueueSpy };
			};

			it('should call not consumeWorkerQueue', async () => {
				const { consumeWorkerQueueSpy } = setup();

				await service.onModuleInit();

				expect(consumeWorkerQueueSpy).not.toHaveBeenCalled();
			});
		});
	});

	describe('consumeWorkerQueue', () => {
		describe('when there are no tasks', () => {
			const setup = async () => {
				const client = createMock<Api>({ _destroyed: true });
				jest.spyOn(apiClass, 'createApiClient').mockResolvedValueOnce(client);

				await service.onModuleInit();
			};

			it('should return an empty array', async () => {
				await setup();

				const result = await service.consumeWorkerQueue();

				expect(result).toEqual([]);
			});
		});

		describe('when there are tasks', () => {
			describe('when stream length is 0', () => {
				describe('when deletedDocEntries is empty', () => {
					const setup = async () => {
						const awareness = createMock<Awareness>();
						const client = createMock<Api>({ _destroyed: true });
						client.getDoc.mockResolvedValue({
							ydoc: createMock<Doc>(),
							awareness,
							redisLastId: '0',
							storeReferences: null,
							docChanged: false,
						});
						jest.spyOn(apiClass, 'createApiClient').mockResolvedValueOnce(client);

						const streamMessageReply1 = streamMessageReplyFactory.build();
						const streamMessageReply2 = streamMessageReplyFactory.build();
						const streamMessageReply3 = streamMessageReplyFactory.build();

						const reclaimedTasks = xAutoClaimResponseFactory.build();
						reclaimedTasks.messages = [streamMessageReply1, streamMessageReply2, streamMessageReply3];

						const redisAdapterMock = createMock<RedisAdapter>({ redisPrefix: 'prefix' });
						redisAdapterMock.reclaimTasks.mockResolvedValueOnce(reclaimedTasks);
						redisAdapterMock.getDeletedDocEntries.mockResolvedValueOnce([]);
						redisAdapterMock.tryClearTask.mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0);

						redisService.createRedisInstance.mockResolvedValueOnce(redisAdapterMock);

						const expectedTasks = reclaimedTasks.messages.map((m) => ({
							stream: m.message.compact.toString(),
							id: m?.id.toString(),
						}));

						await service.onModuleInit();

						return { expectedTasks };
					};

					it('should return an array of tasks', async () => {
						const { expectedTasks } = await setup();

						const result = await service.consumeWorkerQueue();

						expect(result).toEqual(expectedTasks);
					});
				});

				describe('when deletedDocEntries contains element', () => {
					const setup = async () => {
						const awareness = createMock<Awareness>();
						const client = createMock<Api>({ _destroyed: true });
						client.getDoc.mockResolvedValue({
							ydoc: createMock<Doc>(),
							awareness,
							redisLastId: '0',
							storeReferences: null,
							docChanged: false,
						});
						jest.spyOn(apiClass, 'createApiClient').mockResolvedValueOnce(client);

						const streamMessageReply1 = streamMessageReplyFactory.build();
						const streamMessageReply2 = streamMessageReplyFactory.build();
						const streamMessageReply3 = streamMessageReplyFactory.build();

						const reclaimedTasks = xAutoClaimResponseFactory.build();
						reclaimedTasks.messages = [streamMessageReply1, streamMessageReply2, streamMessageReply3];

						const deletedDocEntries = [streamMessageReply2];

						const redisAdapterMock = createMock<RedisAdapter>({ redisPrefix: 'prefix' });
						redisAdapterMock.reclaimTasks.mockResolvedValueOnce(reclaimedTasks);
						redisAdapterMock.getDeletedDocEntries.mockResolvedValueOnce(deletedDocEntries);
						redisAdapterMock.tryClearTask.mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0);

						redisService.createRedisInstance.mockResolvedValueOnce(redisAdapterMock);

						const expectedTasks = reclaimedTasks.messages.map((m) => ({
							stream: m.message.compact.toString(),
							id: m?.id.toString(),
						}));

						await service.onModuleInit();

						return { expectedTasks };
					};

					it('should return an array of tasks', async () => {
						const { expectedTasks } = await setup();

						const result = await service.consumeWorkerQueue();

						expect(result).toEqual(expectedTasks);
					});
				});
			});

			describe('when stream length is not 0', () => {
				describe('when docChanged is false', () => {
					const setup = async () => {
						const awareness = createMock<Awareness>();
						const client = createMock<Api>({ _destroyed: true });
						client.getDoc.mockResolvedValue({
							ydoc: createMock<Doc>(),
							awareness,
							redisLastId: '0',
							storeReferences: null,
							docChanged: false,
						});
						jest.spyOn(apiClass, 'createApiClient').mockResolvedValueOnce(client);

						const streamMessageReply1 = streamMessageReplyFactory.build();
						const streamMessageReply2 = streamMessageReplyFactory.build();
						const streamMessageReply3 = streamMessageReplyFactory.build();

						const reclaimedTasks = xAutoClaimResponseFactory.build();
						reclaimedTasks.messages = [streamMessageReply1, streamMessageReply2, streamMessageReply3];

						const deletedDocEntries = [streamMessageReply2];

						const redisAdapterMock = createMock<RedisAdapter>({ redisPrefix: 'prefix' });
						redisAdapterMock.reclaimTasks.mockResolvedValueOnce(reclaimedTasks);
						redisAdapterMock.getDeletedDocEntries.mockResolvedValueOnce(deletedDocEntries);
						redisAdapterMock.tryClearTask
							.mockImplementationOnce(async (task) => {
								return await Promise.resolve(task.stream.length);
							})
							.mockImplementationOnce(async (task) => {
								return await Promise.resolve(task.stream.length);
							})
							.mockImplementationOnce(async (task) => {
								return await Promise.resolve(task.stream.length);
							});

						redisService.createRedisInstance.mockResolvedValueOnce(redisAdapterMock);

						const expectedTasks = reclaimedTasks.messages.map((m) => ({
							stream: m.message.compact.toString(),
							id: m?.id.toString(),
						}));

						await service.onModuleInit();

						return { expectedTasks };
					};

					it('should return an array of tasks', async () => {
						const { expectedTasks } = await setup();

						const result = await service.consumeWorkerQueue();

						expect(result).toEqual(expectedTasks);
					});
				});

				describe('when docChanged is true', () => {
					const setup = async () => {
						const awareness = createMock<Awareness>();
						const client = createMock<Api>({ _destroyed: true });
						client.getDoc.mockResolvedValue({
							ydoc: createMock<Doc>(),
							awareness,
							redisLastId: '0',
							storeReferences: null,
							docChanged: true,
						});
						jest.spyOn(apiClass, 'createApiClient').mockResolvedValueOnce(client);

						const streamMessageReply1 = streamMessageReplyFactory.build();
						const streamMessageReply2 = streamMessageReplyFactory.build();
						const streamMessageReply3 = streamMessageReplyFactory.build();

						const reclaimedTasks = xAutoClaimResponseFactory.build();
						reclaimedTasks.messages = [streamMessageReply1, streamMessageReply2, streamMessageReply3];

						const deletedDocEntries = [streamMessageReply2];

						const redisAdapterMock = createMock<RedisAdapter>({ redisPrefix: 'prefix' });
						redisAdapterMock.reclaimTasks.mockResolvedValueOnce(reclaimedTasks);
						redisAdapterMock.getDeletedDocEntries.mockResolvedValueOnce(deletedDocEntries);
						redisAdapterMock.tryClearTask
							.mockImplementationOnce(async (task) => {
								return await Promise.resolve(task.stream.length);
							})
							.mockImplementationOnce(async (task) => {
								return await Promise.resolve(task.stream.length);
							})
							.mockImplementationOnce(async (task) => {
								return await Promise.resolve(task.stream.length);
							});

						redisService.createRedisInstance.mockResolvedValueOnce(redisAdapterMock);

						const expectedTasks = reclaimedTasks.messages.map((m) => ({
							stream: m.message.compact.toString(),
							id: m?.id.toString(),
						}));

						await service.onModuleInit();

						return { expectedTasks };
					};

					it('should return an array of tasks', async () => {
						// docChanged = true;

						const { expectedTasks } = await setup();

						const result = await service.consumeWorkerQueue();

						expect(result).toEqual(expectedTasks);
					});
				});
			});
		});
	});
});
