import { Redis } from 'ioredis';
import { IoRedisAdapter } from './ioredis.adapter.js';

describe(IoRedisAdapter.name, () => {
	let redis: Redis;
	let redisAdapter: IoRedisAdapter;
	let prefix: string;

	beforeAll(async () => {
		redis = new Redis();
		prefix = 'prefix';
		redisAdapter = new IoRedisAdapter(redis, {} as any, {} as any);
		await redisAdapter.createGroup();
	});

	afterAll(() => {
		redis.quit();
	});

	describe('addMessage', () => {
		it('should call redis addMessage with correct values', async () => {
			const key = 'key';
			const message = 'message';
			// @ts-ignore
			const addMessageSpy = jest.spyOn(redis, 'addMessage');

			await redisAdapter.addMessage(key, message);

			expect(addMessageSpy).toHaveBeenCalledWith(key, message);
		});
	});

	describe('getEntriesLen', () => {
		it('should call redis xlen with correct values', async () => {
			const streamName = 'streamName';

			const xlenSpy = jest.spyOn(redis, 'xlen');

			await redisAdapter.getEntriesLen(streamName);

			expect(xlenSpy).toHaveBeenCalledWith(streamName);
		});
	});

	describe('exists', () => {
		it('should call redis exists with correct values', async () => {
			const stream = 'stream';

			const existsSpy = jest.spyOn(redis, 'exists');

			await redisAdapter.exists(stream);

			expect(existsSpy).toHaveBeenCalledWith(stream);
		});
	});

	describe('createGroup', () => {
		it('should call redis xgroup with correct values', async () => {
			const xgroupSpy = jest.spyOn(redis, 'xgroup');

			await redisAdapter.createGroup();

			expect(xgroupSpy).toHaveBeenCalledWith(
				'CREATE',
				redisAdapter['redisWorkerStreamName'],
				redisAdapter['redisWorkerGroupName'],
				'0',
				'MKSTREAM',
			);
		});
	});

	describe('readStreams', () => {
		it('should call redis xreadBuffer with correct values', async () => {
			const xreadBufferSpy = jest.spyOn(redis, 'xreadBuffer');
			const streams = [
				{ key: 'key', id: '1728917177284-0' },
				{ key: 'key', id: '1728917437949-0' },
			];

			await redisAdapter.readStreams(streams);

			expect(xreadBufferSpy).toHaveBeenCalledWith(
				'COUNT',
				1000,
				'BLOCK',
				1000,
				'STREAMS',
				...streams.map((stream) => stream.key),
				...streams.map((stream) => stream.id),
			);
		});
	});

	describe('readMessagesFromStream', () => {
		it('should call redis xreadBuffer with correct values', async () => {
			const xreadBufferSpy = jest.spyOn(redis, 'xreadBuffer');
			const computeRedisRoomStreamName = 'computeRedisRoomStreamName';

			await redisAdapter.readMessagesFromStream(computeRedisRoomStreamName);

			expect(xreadBufferSpy).toHaveBeenCalledWith(
				'COUNT',
				1000,
				'BLOCK',
				1000,
				'STREAMS',
				computeRedisRoomStreamName,
				'0',
			);
		});
	});

	describe('reclaimTasks', () => {
		it('should call redis xautoclaim with correct values', async () => {
			const xautoclaimSpy = jest.spyOn(redis, 'xautoclaim');
			const consumer = 'consumer';
			const redisTaskDebounce = 1000;

			await redisAdapter.reclaimTasks(consumer, redisTaskDebounce);

			expect(xautoclaimSpy).toHaveBeenCalledWith(
				redisAdapter['redisWorkerStreamName'],
				redisAdapter['redisWorkerGroupName'],
				consumer,
				redisTaskDebounce,
				'0',
				'COUNT',
				5,
			);
		});
	});

	describe('markToDeleteByDocName', () => {
		it('should call redis xadd with correct values', async () => {
			const docName = 'docName';
			const xaddSpy = jest.spyOn(redis, 'xadd');

			await redisAdapter.markToDeleteByDocName(docName);

			expect(xaddSpy).toHaveBeenCalledWith(redisAdapter['redisDeleteStreamName'], '*', 'docName', docName);
		});
	});

	describe('getDeletedDocEntries', () => {
		it('should call redis xrangeBuffer with correct values', async () => {
			const xrangeBufferSpy = jest.spyOn(redis, 'xrangeBuffer');
			const redisDeleteStreamName = 'prefix:delete';

			await redisAdapter.getDeletedDocEntries();

			expect(xrangeBufferSpy).toHaveBeenCalledWith(redisDeleteStreamName, '-', '+');
		});
	});

	describe('deleteDeleteDocEntry', () => {
		it('should call redis xdel with correct values', async () => {
			const id = '1728975844762-0';
			const xdelSpy = jest.spyOn(redis, 'xdel');

			await redisAdapter.deleteDeleteDocEntry(id);

			expect(xdelSpy).toHaveBeenCalledWith(redisAdapter['redisDeleteStreamName'], id);
		});
	});

	/*describe('quit', () => {
		it('should call redis quit with correct values', async () => {
			const quitSpy = jest.spyOn(redis, 'quit');

			await redisAdapter.quit();

			expect(quitSpy).toHaveBeenCalled();
		});
	});*/
});
