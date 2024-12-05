import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { Awareness } from 'y-protocols/awareness.js';
import { Doc } from 'yjs';
import { Logger } from '../../infra/logger/logger.js';
import { RedisAdapter } from '../../infra/redis/interfaces/index.js';
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
						WORKER_IDLE_BREAK_MS: 1,
					},
				},
			],
		}).compile();

		await module.init(); // this is where onModuleInit is called, do module.resolve the same?
		service = await module.resolve(WorkerService);
		redisService = module.get(RedisService);

		await service.onModuleInit();
	});

	afterEach(() => {
		jest.restoreAllMocks();
		service.stop();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('job', () => {
		describe('when new service instance is running', () => {
			const setup = () => {
				service.start();

				const spy = jest.spyOn(service, 'consumeWorkerQueue');

				return { spy };
			};

			it('and stop is called, it should be stopped', () => {
				setup();

				service.stop();

				expect(service.status()).toBe(false);
			});

			it('and start is called, it should be run', () => {
				setup();

				service.start();

				expect(service.status()).toBe(true);
			});

			it('should call consumeWorkerQueue', async () => {
				const { spy } = setup();

				await new Promise((resolve) => setTimeout(resolve, 10));

				expect(spy).toHaveBeenCalled();
			});

			it('should running after calling onModuleInit', () => {
				setup();

				service.onModuleInit();

				expect(service.status()).toBe(true);
			});
		});

		describe('when new service instance is not running', () => {
			const setup = () => {
				service.stop();
				const spy = jest.spyOn(service, 'consumeWorkerQueue');

				return { spy };
			};

			it('and start is called, it should be started', () => {
				setup();

				service.start();

				expect(service.status()).toBe(true);
			});

			it('and stop is called, it should stopped', () => {
				setup();

				service.stop();

				expect(service.status()).toBe(false);
			});

			it('should not call consumeWorkerQueue', async () => {
				const { spy } = setup();

				await new Promise((resolve) => setTimeout(resolve, 10));

				expect(spy).not.toHaveBeenCalled();
			});
		});
	});

	describe('consumeWorkerQueue', () => {
		describe('when there are no tasks', () => {
			const setup = () => {
				service.start();
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
						// ClientMock
						const client: DeepMocked<Api> = createMock<Api>();
						client.getDoc.mockResolvedValue({
							ydoc: createMock<Doc>(),
							awareness: createMock<Awareness>(),
							redisLastId: '0',
							storeReferences: null,
							docChanged: false,
						});
						jest.spyOn(apiClass, 'createApiClient').mockResolvedValueOnce(client);

						// RedisAdapterMock
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

						// Needed to override service.client and service.redis
						await service.onModuleInit();

						// Test setup
						const expectedTasks = reclaimedTasks.messages.map((m) => ({
							stream: m.message.compact.toString(),
							id: m?.id.toString(),
						}));

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
						const client: DeepMocked<Api> = createMock<Api>();
						client.getDoc.mockResolvedValue({
							ydoc: createMock<Doc>(),
							awareness: createMock<Awareness>(),
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
						const client: DeepMocked<Api> = createMock<Api>();
						client.getDoc.mockResolvedValue({
							ydoc: createMock<Doc>(),
							awareness: createMock<Awareness>(),
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
						const client: DeepMocked<Api> = createMock<Api>();
						client.getDoc.mockResolvedValue({
							ydoc: createMock<Doc>(),
							awareness: createMock<Awareness>(),
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
						const { expectedTasks } = await setup();

						const result = await service.consumeWorkerQueue();

						expect(result).toEqual(expectedTasks);
					});
				});
			});
		});
	});
});
