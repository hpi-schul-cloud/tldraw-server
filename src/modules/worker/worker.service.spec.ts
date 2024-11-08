let callCount = 0;
let docChanged = false;

jest.mock('../../infra/y-redis/api.service.js', () => {
	return {
		createApiClient: jest.fn().mockImplementation(() => {
			return {
				prototype: jest.fn(),
				get _destroyed() {
					if (callCount === 0) {
						callCount++;

						return false;
					}

					return true;
				},
				getDoc: jest.fn().mockResolvedValue({
					ydoc: createMock<Doc>(),
					awareness: {
						destroy: jest.fn(),
					},
					redisLastId: '0',
					storeReferences: null,
					docChanged: docChanged,
				}),
			};
		}),
	};
});

import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { Doc } from 'yjs';
import { Logger } from '../../infra/logger/logger.js';
import { RedisAdapter } from '../../infra/redis/interfaces/redis-adapter.js';
import { RedisService } from '../../infra/redis/redis.service.js';
import {
	streamMessageReplyFactory,
	xAutoClaimResponseFactory,
} from '../../infra/redis/testing/x-auto-claim-response.factory.js';
import { StorageService } from '../../infra/storage/storage.service.js';
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
		callCount = 0;
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('onModuleInit', () => {
		describe('when _destroyed is false', () => {
			const setup = () => {
				const consumeWorkerQueueSpy = jest.spyOn(service, 'consumeWorkerQueue').mockResolvedValueOnce([]);

				return { consumeWorkerQueueSpy };
			};

			it('should call consumeWorkerQueue', async () => {
				const { consumeWorkerQueueSpy } = setup();

				await service.onModuleInit();

				expect(consumeWorkerQueueSpy).toHaveBeenCalled();
			});
		});

		describe('when _destroyed is true', () => {
			const setup = () => {
				callCount = 1;

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
				callCount = 1;

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
						callCount = 1;

						const streamMessageReply1 = streamMessageReplyFactory.build();
						const streamMessageReply2 = streamMessageReplyFactory.build();
						const streamMessageReply3 = streamMessageReplyFactory.build();

						const reclaimedTasks = xAutoClaimResponseFactory.build();
						reclaimedTasks.messages = [streamMessageReply1, streamMessageReply2, streamMessageReply3];

						const redisAdapterMock = createMock<RedisAdapter>({ redisPrefix: 'prefix' });
						redisAdapterMock.reclaimTasks.mockResolvedValueOnce(reclaimedTasks);
						redisAdapterMock.getDeletedDocEntries.mockResolvedValueOnce([]);

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
						callCount = 1;

						const streamMessageReply1 = streamMessageReplyFactory.build();
						const streamMessageReply2 = streamMessageReplyFactory.build();
						const streamMessageReply3 = streamMessageReplyFactory.build();

						const reclaimedTasks = xAutoClaimResponseFactory.build();
						reclaimedTasks.messages = [streamMessageReply1, streamMessageReply2, streamMessageReply3];

						const deletedDocEntries = [streamMessageReply2];

						const redisAdapterMock = createMock<RedisAdapter>({ redisPrefix: 'prefix' });
						redisAdapterMock.reclaimTasks.mockResolvedValueOnce(reclaimedTasks);
						redisAdapterMock.getDeletedDocEntries.mockResolvedValueOnce(deletedDocEntries);

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
				const setup = async () => {
					callCount = 1;

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

				describe('when docChanged is false', () => {
					it('should return an array of tasks', async () => {
						const { expectedTasks } = await setup();

						const result = await service.consumeWorkerQueue();

						expect(result).toEqual(expectedTasks);
					});
				});

				describe('when docChanged is true', () => {
					it('should return an array of tasks', async () => {
						docChanged = true;

						const { expectedTasks } = await setup();

						const result = await service.consumeWorkerQueue();

						expect(result).toEqual(expectedTasks);
					});
				});
			});
		});
	});
});
