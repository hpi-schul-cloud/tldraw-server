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
		redisAdapter = await module.get(RedisService).createRedisInstance();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('onModuleInit', () => {
		// describe('when _destroyed is false', () => {
		// 	const setup = () => {
		// 		_destroyed = false;

		// 		const reclaimedTasks = xAutoClaimResponse.build();

		// 		jest.spyOn(redisAdapter, 'reclaimTasks').mockResolvedValue(reclaimedTasks);
		// 		jest.spyOn(redisAdapter, 'getDeletedDocEntries').mockResolvedValue([]);

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

				const reclaimedTasks = xAutoClaimResponse.build();

				jest.spyOn(redisAdapter, 'reclaimTasks').mockResolvedValue(reclaimedTasks);
				jest.spyOn(redisAdapter, 'getDeletedDocEntries').mockResolvedValue([]);

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

				const reclaimedTasks = xAutoClaimResponse.build();

				jest.spyOn(redisAdapter, 'reclaimTasks').mockResolvedValue(reclaimedTasks);
				jest.spyOn(redisAdapter, 'getDeletedDocEntries').mockResolvedValue([]);

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

				const reclaimedTasks = xAutoClaimResponse.build();
				reclaimedTasks.messages = [streamMessageReply.build()];

				jest.spyOn(redisAdapter, 'reclaimTasks').mockResolvedValue(reclaimedTasks);
				jest.spyOn(redisAdapter, 'getDeletedDocEntries').mockResolvedValue([]);

				await service.onModuleInit();
			};

			it('should return an array of tasks', async () => {
				await setup();
				const result = await service.consumeWorkerQueue();
				// expect(result).toEqual([{ stream: 'stream', id: 'id' }]);
			});
		});
	});
});
