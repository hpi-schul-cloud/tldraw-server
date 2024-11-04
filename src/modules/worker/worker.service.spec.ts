jest.mock('../../infra/y-redis/api.service.js', () => {
	return {
		createApiClient: jest.fn().mockImplementation(() => {
			return {
				prototype: jest.fn(),
				_destroyed: true,
			};
		}),
		Api: jest.fn().mockImplementation(() => {
			return {
				prototype: jest.fn(),
				_destroyed: false,
			};
		}),
	};
});

import { createMock } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { streamsMessagesReplyFactory } from 'infra/y-redis/testing/streams-messages-reply.factory.js';
import { Logger } from '../../infra/logger/logger.js';
import { RedisAdapter } from '../../infra/redis/redis.adapter.js';
import { RedisService } from '../../infra/redis/redis.service.js';
import { xAutoClaimBufferRawReply } from '../../infra/redis/testing/x-auto-claim-raw-reply.factory.js';
import { xItemBufferFactory } from '../../infra/redis/testing/x-item.factory.js';
import { xItemsBufferFactory } from '../../infra/redis/testing/x-items.factory.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import { WorkerConfig } from './worker.config.js';
import { WorkerService } from './worker.service.js';

describe(WorkerService.name, () => {
	let service: WorkerService;
	let storageService: StorageService;
	let redisService: RedisAdapter;

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
		redisService = await module.get(RedisService).createRedisInstance();
	});

	describe('consumeWorkerQueue', () => {
		const setup = async () => {
			const xItem = xItemBufferFactory.build([Buffer.from('compact'), [Buffer.from('id')]]);
			const xItems = xItemsBufferFactory.build([xItem]);
			const xAutoClaim = xAutoClaimBufferRawReply.build();
			const reclaimedTasksRes = streamsMessagesReplyFactory.build();

			jest.spyOn(redisService, 'reclaimTasks').mockResolvedValue(reclaimedTasksRes);

			jest.spyOn(redisService, 'getDeletedDocEntries').mockResolvedValue([]);

			await service.onModuleInit();
		};

		it('should return an empty array', async () => {
			await setup();
			const result = await service.consumeWorkerQueue();
			expect(result).toEqual([]);
		});

		it('should return an array of tasks', async () => {
			await setup();
			const result = await service.consumeWorkerQueue();
			expect(result).toEqual([{ stream: 'stream', id: 'id' }]);
		});
	});
});
