let _destroyed = false;

jest.mock('../../infra/y-redis/api.service.js', () => {
	return {
		createApiClient: jest.fn().mockImplementation(() => {
			return {
				prototype: jest.fn(),
				_destroyed: _destroyed,
			};
		}),
		Api: jest.fn().mockImplementation(() => {
			return {
				prototype: jest.fn(),
				_destroyed: _destroyed,
			};
		}),
	};
});

import { createMock } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '../../infra/logger/logger.js';
import { RedisAdapter } from '../../infra/redis/redis.adapter.js';
import { RedisService } from '../../infra/redis/redis.service.js';
import { streamMessageReply, xAutoClaimResponse } from '../../infra/redis/testing/x-auto-claim-response.factory.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import { WorkerConfig } from './worker.config.js';
import { WorkerService } from './worker.service.js';

describe(WorkerService.name, () => {
	let service: WorkerService;
	let storageService: StorageService;
	let redisService: RedisService;
	let redisAdapter: RedisAdapter;

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
		storageService = module.get(StorageService);
		redisService = module.get(RedisService);

		const reclaimedTasks = xAutoClaimResponse.build();

		redisAdapter = createMock<RedisAdapter>({
			redisPrefix: 'prefix',
			reclaimTasks: jest.fn().mockResolvedValue(reclaimedTasks),
			getDeletedDocEntries: jest.fn().mockResolvedValue([]),
			tryClearTask: jest.fn().mockResolvedValue(0),
			tryDeduplicateTask: jest.fn().mockResolvedValue(undefined),
			deleteDeleteDocEntry: jest.fn().mockResolvedValue(undefined),
		});

		jest.spyOn(redisService, 'createRedisInstance').mockResolvedValue(redisAdapter);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('onModuleInit', () => {
		// describe('when _destroyed is false', () => {
		// 	const setup = () => {
		// 		_destroyed = false;

		// 		const consumeWorkerQueueSpy = jest.spyOn(service, 'consumeWorkerQueue').mockResolvedValue([]);

		// 		return { consumeWorkerQueueSpy };
		// 	};

		// 	it('should call consumeWorkerQueue', async () => {
		// 		const { consumeWorkerQueueSpy } = setup();

		// 		await service.onModuleInit();

		// 		expect(consumeWorkerQueueSpy).toHaveBeenCalled();
		// 	});
		// });

		describe('when _destroyed is true', () => {
			const setup = () => {
				_destroyed = true;

				const consumeWorkerQueueSpy = jest.spyOn(service, 'consumeWorkerQueue').mockResolvedValue([]);

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
				_destroyed = true;

				await service.onModuleInit();
			};

			it('should return an empty array', async () => {
				await setup();

				const result = await service.consumeWorkerQueue();

				expect(result).toEqual([]);
			});
		});

		describe('when there are tasks', () => {
			const setup = async () => {
				_destroyed = true;

				const streamMessageReply1 = streamMessageReply.build();
				const streamMessageReply2 = streamMessageReply.build();
				const streamMessageReply3 = streamMessageReply.build();

				const reclaimedTasks = xAutoClaimResponse.build();
				reclaimedTasks.messages = [streamMessageReply1, streamMessageReply2, streamMessageReply3];

				const deletedDocEntries = [streamMessageReply2];

				jest.spyOn(redisAdapter, 'reclaimTasks').mockResolvedValue(reclaimedTasks);
				jest.spyOn(redisAdapter, 'getDeletedDocEntries').mockResolvedValue(deletedDocEntries);

				await service.onModuleInit();
			};

			it('should return an array of tasks', async () => {
				await setup();
				const result = await service.consumeWorkerQueue();
				expect(result).toEqual([
					{ stream: 'prefix:room:room:docid', id: '1' },
					{ stream: 'prefix:room:room:docid', id: '2' },
					{ stream: 'prefix:room:room:docid', id: '3' },
				]);
			});
		});
	});
});
