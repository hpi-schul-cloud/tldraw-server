import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { Awareness } from 'y-protocols/awareness';
import { Doc } from 'yjs';
import { Logger } from '../../infra/logger/index.js';
import { RedisAdapter, StreamMessageReply, Task } from '../../infra/redis/index.js';
import { streamMessageReplyFactory, xAutoClaimResponseFactory } from '../../infra/redis/testing/index.js';
import { StorageService } from '../../infra/storage/index.js';
import { YRedisClient } from '../../infra/y-redis/index.js';
import { yRedisDocFactory } from '../../infra/y-redis/testing/index.js';
import { WorkerConfig } from './worker.config.js';
import { REDIS_FOR_WORKER } from './worker.const.js';
import { WorkerService } from './worker.service.js';

const mapStreamMessageRepliesToTask = (streamMessageReplies: StreamMessageReply[]) => {
	const tasks: Task[] = [];

	streamMessageReplies.forEach((message) => {
		if ('compact' in message.message) {
			tasks.push({
				stream: message.message.compact.toString(),
				id: message.id.toString(),
			});
		}
	});

	return tasks;
};

describe(WorkerService.name, () => {
	let module: TestingModule;
	let service: WorkerService;
	let redisAdapter: DeepMocked<RedisAdapter>;
	let yRedisClient: DeepMocked<YRedisClient>;
	let storageService: DeepMocked<StorageService>;

	beforeAll(async () => {
		// TODO: should we start the app as api-test for this job?
		module = await Test.createTestingModule({
			providers: [
				WorkerService,
				{
					provide: YRedisClient,
					useValue: createMock<YRedisClient>(),
				},
				{
					provide: StorageService,
					useValue: createMock<StorageService>(),
				},
				{
					provide: REDIS_FOR_WORKER,
					useValue: createMock<RedisAdapter>({ redisPrefix: 'prefix' }),
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

		service = await module.resolve(WorkerService);
		redisAdapter = module.get(REDIS_FOR_WORKER);
		yRedisClient = module.get(YRedisClient);
		storageService = module.get(StorageService);
	});

	afterEach(() => {
		jest.restoreAllMocks();
		service.stop();
	});

	afterAll(async () => {
		await module.close();
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

			it('and start is called, it should run', () => {
				setup();

				service.start();

				expect(service.status()).toBe(true);
			});

			it('should call consumeWorkerQueue', async () => {
				const { spy } = setup();

				await new Promise((resolve) => setTimeout(resolve, 10));

				expect(spy).toHaveBeenCalled();
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
		describe('when there are tasks', () => {
			describe('when stream length is 0', () => {
				describe('when deletedDocEntries is empty', () => {
					const setup = () => {
						const yRedisDocMock = yRedisDocFactory.build();
						yRedisClient.getDoc.mockResolvedValue(yRedisDocMock);

						const streamMessageReplys = streamMessageReplyFactory.buildList(3);
						const reclaimedTasks = xAutoClaimResponseFactory.build();
						reclaimedTasks.messages = streamMessageReplys;
						const deletedDocEntries: StreamMessageReply[] = [];

						redisAdapter.reclaimTasks.mockResolvedValueOnce(reclaimedTasks);
						redisAdapter.getDeletedDocEntries.mockResolvedValueOnce(deletedDocEntries);
						redisAdapter.tryClearTask.mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0);

						const expectedTasks = mapStreamMessageRepliesToTask(reclaimedTasks.messages);

						return { expectedTasks };
					};

					it('should return an array of tasks', async () => {
						const { expectedTasks } = setup();

						const result = await service.consumeWorkerQueue();

						expect(result).toEqual(expectedTasks);
					});
				});

				describe('when deletedDocEntries contains element', () => {
					const setup = () => {
						const yRedisDocMock = yRedisDocFactory.build();
						yRedisClient.getDoc.mockResolvedValue(yRedisDocMock);

						const streamMessageReplys = streamMessageReplyFactory.buildList(3);
						const reclaimedTasks = xAutoClaimResponseFactory.build();
						reclaimedTasks.messages = streamMessageReplys;
						const deletedDocEntries = [streamMessageReplys[2]];

						redisAdapter.reclaimTasks.mockResolvedValueOnce(reclaimedTasks);
						redisAdapter.getDeletedDocEntries.mockResolvedValueOnce(deletedDocEntries);
						redisAdapter.tryClearTask.mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0);

						const expectedTasks = mapStreamMessageRepliesToTask(reclaimedTasks.messages);

						return { expectedTasks };
					};

					it('should return an array of tasks', async () => {
						const { expectedTasks } = setup();

						const result = await service.consumeWorkerQueue();

						expect(result).toEqual(expectedTasks);
					});
				});
			});

			describe('when stream length is not 0', () => {
				describe('when docChanged is false', () => {
					const setup = () => {
						const yRedisDocMock = yRedisDocFactory.build();
						yRedisClient.getDoc.mockResolvedValue(yRedisDocMock);

						const streamMessageReplys = streamMessageReplyFactory.buildList(3);
						const reclaimedTasks = xAutoClaimResponseFactory.build();
						reclaimedTasks.messages = streamMessageReplys;
						const deletedDocEntries = [streamMessageReplys[2]];

						redisAdapter.reclaimTasks.mockResolvedValueOnce(reclaimedTasks);
						redisAdapter.getDeletedDocEntries.mockResolvedValueOnce(deletedDocEntries);
						redisAdapter.tryClearTask
							.mockImplementationOnce(async (task) => {
								return await Promise.resolve(task.stream.length);
							})
							.mockImplementationOnce(async (task) => {
								return await Promise.resolve(task.stream.length);
							})
							.mockImplementationOnce(async (task) => {
								return await Promise.resolve(task.stream.length);
							});

						const expectedTasks = mapStreamMessageRepliesToTask(reclaimedTasks.messages);

						return { expectedTasks };
					};

					it('should return an array of tasks', async () => {
						const { expectedTasks } = setup();

						const result = await service.consumeWorkerQueue();

						expect(result).toEqual(expectedTasks);
					});
				});

				describe('when docChanged is true', () => {
					describe('when storeReferences is null', () => {
						const setup = () => {
							const yRedisDocMock = yRedisDocFactory.build();
							yRedisClient.getDoc.mockResolvedValue(yRedisDocMock);

							const streamMessageReplys = streamMessageReplyFactory.buildList(3);
							const reclaimedTasks = xAutoClaimResponseFactory.build();
							reclaimedTasks.messages = streamMessageReplys;
							const deletedDocEntries = [streamMessageReplys[2]];

							redisAdapter.reclaimTasks.mockResolvedValueOnce(reclaimedTasks);
							redisAdapter.getDeletedDocEntries.mockResolvedValueOnce(deletedDocEntries);
							redisAdapter.tryClearTask
								.mockImplementationOnce(async (task) => {
									return await Promise.resolve(task.stream.length);
								})
								.mockImplementationOnce(async (task) => {
									return await Promise.resolve(task.stream.length);
								})
								.mockImplementationOnce(async (task) => {
									return await Promise.resolve(task.stream.length);
								});

							const expectedTasks = mapStreamMessageRepliesToTask(reclaimedTasks.messages);

							return { expectedTasks };
						};

						it('should return an array of tasks', async () => {
							const { expectedTasks } = setup();

							const result = await service.consumeWorkerQueue();

							expect(result).toEqual(expectedTasks);
						});
					});

					describe('when storeReferences is defined', () => {
						const setup = () => {
							const storeReferences = ['storeReference1', 'storeReference2'];
							const yRedisDocMock = {
								ydoc: createMock<Doc>(),
								awareness: createMock<Awareness>(),
								redisLastId: '0',
								storeReferences,
								docChanged: true,
								streamName: '',
								getAwarenessStateSize: () => 1,
							};
							yRedisClient.getDoc.mockResolvedValue(yRedisDocMock);

							const streamMessageReplys = streamMessageReplyFactory.buildList(3);
							const reclaimedTasks = xAutoClaimResponseFactory.build();
							reclaimedTasks.messages = streamMessageReplys;
							const deletedDocEntries = [streamMessageReplys[2]];

							redisAdapter.reclaimTasks.mockResolvedValueOnce(reclaimedTasks);
							redisAdapter.getDeletedDocEntries.mockResolvedValueOnce(deletedDocEntries);
							redisAdapter.tryClearTask
								.mockImplementationOnce(async (task) => {
									return await Promise.resolve(task.stream.length);
								})
								.mockImplementationOnce(async (task) => {
									return await Promise.resolve(task.stream.length);
								})
								.mockImplementationOnce(async (task) => {
									return await Promise.resolve(task.stream.length);
								});

							const expectedTasks = mapStreamMessageRepliesToTask(reclaimedTasks.messages);

							return { expectedTasks, storeReferences };
						};

						it('should return an array of tasks and delete references', async () => {
							const { expectedTasks, storeReferences } = setup();

							const result = await service.consumeWorkerQueue();

							expect(result).toEqual(expectedTasks);
							expect(storageService.deleteReferences).toHaveBeenNthCalledWith(
								1,
								'room',
								expect.stringContaining('docid-'),
								storeReferences,
							);
							expect(storageService.deleteReferences).toHaveBeenNthCalledWith(
								2,
								'room',
								expect.stringContaining('docid-'),
								storeReferences,
							);
							expect(storageService.deleteReferences).toHaveBeenNthCalledWith(
								3,
								'room',
								expect.stringContaining('docid-'),
								storeReferences,
							);
						});
					});
				});
			});
		});
	});
});
