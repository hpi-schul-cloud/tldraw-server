import { createMock } from '@golevelup/ts-jest';
import { Redis } from 'ioredis';
import { Logger } from '../logger/index.js';
import { IoRedisAdapter } from './ioredis.adapter.js';
import { RedisConfig } from './redis.config.js';
import { xAutoClaimRawReplyFactory } from './testing/x-auto-claim-raw-reply.factory.js';
import { xItemsBufferFactory } from './testing/x-items.factory.js';
import { xReadBufferReplyFactory } from './testing/x-read-buffer-reply.factory.js';

describe(IoRedisAdapter.name, () => {
	const testPrefix = 'testPrefix';
	const buildParams = async () => {
		const logger = createMock<Logger>();
		const config = createMock<RedisConfig>({
			REDIS_PREFIX: testPrefix,
		});
		const redis = createMock<Redis>();
		const redisAdapter = new IoRedisAdapter(redis, config, logger);
		await redisAdapter.createGroup();

		return { redisAdapter, redis, logger };
	};

	describe('subscribeToDeleteChannel', () => {
		const setup = async () => {
			const { redisAdapter, redis } = await buildParams();
			const subscribeSpy = jest.spyOn(redis, 'subscribe');
			const onSpy = jest.spyOn(redis, 'on');
			const callback = jest.fn();

			const expectedProps = [redisAdapter.redisDeletionActionKey];

			return { subscribeSpy, onSpy, callback, expectedProps, redisAdapter, redis };
		};

		it('should call redis subscribe with correct values', async () => {
			const { subscribeSpy, callback, expectedProps, redisAdapter } = await setup();

			redisAdapter.subscribeToDeleteChannel(callback);

			expect(subscribeSpy).toHaveBeenCalledWith(...expectedProps);
		});

		it('should call redis on with correct values', async () => {
			const { onSpy, callback, redisAdapter } = await setup();

			redisAdapter.subscribeToDeleteChannel(callback);

			expect(onSpy).toHaveBeenCalled();
		});

		it('should call callback with correct values', async () => {
			const { callback, redisAdapter, redis } = await setup();
			// @ts-ignore
			redis.on.mockImplementation((event, cb) => {
				cb(event, 'message');
			});

			redisAdapter.subscribeToDeleteChannel(callback);

			expect(callback).toHaveBeenCalledWith('message');
		});
	});

	describe('addMessage', () => {
		const setup = async () => {
			const { redisAdapter, redis } = await buildParams();
			const key = 'key';
			const message = 'message';
			// @ts-ignore
			const addMessageSpy = jest.spyOn(redis, 'addMessage');

			const expectedProps = [key, message];

			return { key, message, addMessageSpy, expectedProps, redisAdapter };
		};

		it('should call redis addMessage with correct values', async () => {
			const { key, message, addMessageSpy, expectedProps, redisAdapter } = await setup();

			await redisAdapter.addMessage(key, message);

			expect(addMessageSpy).toHaveBeenCalledWith(...expectedProps);
		});
	});

	describe('getEntriesLen', () => {
		const setup = async () => {
			const { redisAdapter, redis } = await buildParams();
			const streamName = 'streamName';
			const xlenSpy = jest.spyOn(redis, 'xlen');

			xlenSpy.mockResolvedValue(0);

			return { streamName, xlenSpy, redisAdapter };
		};

		it('should call redis xlen with correct values', async () => {
			const { streamName, xlenSpy, redisAdapter } = await setup();

			await redisAdapter.getEntriesLen(streamName);

			expect(xlenSpy).toHaveBeenCalledWith(streamName);
		});

		it('should return correct value', async () => {
			const { streamName, redisAdapter } = await setup();

			const result = await redisAdapter.getEntriesLen(streamName);

			expect(result).toBe(0);
		});
	});

	describe('exists', () => {
		const setup = async () => {
			const { redisAdapter, redis } = await buildParams();
			const stream = 'stream';
			const existsSpy = jest.spyOn(redis, 'exists');

			existsSpy.mockResolvedValue(1);

			return { stream, existsSpy, redisAdapter };
		};

		it('should call redis exists with correct values', async () => {
			const { stream, existsSpy, redisAdapter } = await setup();

			await redisAdapter.exists(stream);

			expect(existsSpy).toHaveBeenCalledWith(stream);
		});

		it('should return correct value', async () => {
			const { stream, redisAdapter } = await setup();

			const result = await redisAdapter.exists(stream);

			expect(result).toBe(1);
		});
	});

	describe('createGroup', () => {
		const setup = async () => {
			const { redisAdapter, redis, logger } = await buildParams();
			const xgroupSpy = jest.spyOn(redis, 'xgroup');

			const expectedProps = [
				'CREATE',
				redisAdapter.redisWorkerStreamName,
				redisAdapter.redisWorkerGroupName,
				'0',
				'MKSTREAM',
			];

			return { xgroupSpy, expectedProps, redisAdapter, redis, logger };
		};
		it('should call redis xgroup with correct values', async () => {
			const { xgroupSpy, expectedProps, redisAdapter } = await setup();

			await redisAdapter.createGroup();

			expect(xgroupSpy).toHaveBeenCalledWith(...expectedProps);
		});

		it('should throw error', async () => {
			const { redis, redisAdapter } = await setup();

			const xgroupSpy = jest.spyOn(redis, 'xgroup');
			// @ts-ignore
			xgroupSpy.mockRejectedValue(new Error('error'));

			await expect(redisAdapter.createGroup()).rejects.toThrow('error');
		});

		it('should not throw error', async () => {
			const { redis, redisAdapter } = await setup();

			const xgroupSpy = jest.spyOn(redis, 'xgroup');
			const error = new Error('BUSYGROUP Consumer Group name already exists');
			// @ts-ignore
			xgroupSpy.mockRejectedValue(error);

			await expect(redisAdapter.createGroup()).resolves.not.toThrow();
		});

		it('should call logger.log with error', async () => {
			const { redis, redisAdapter, logger } = await setup();

			const xgroupSpy = jest.spyOn(redis, 'xgroup');
			const error = new Error('BUSYGROUP Consumer Group name already exists');
			// @ts-ignore
			xgroupSpy.mockRejectedValue(error);

			await redisAdapter.createGroup();

			expect(logger.log).toHaveBeenCalledWith(error);
		});
	});

	describe('readStreams', () => {
		const setup = async () => {
			const { redisAdapter, redis } = await buildParams();
			const streams = [{ key: 'key', id: '1728917177284-0' }];
			const xreadBufferSpy = jest.spyOn(redis, 'xreadBuffer');

			const reply = xReadBufferReplyFactory.build();
			// @ts-ignore
			xreadBufferSpy.mockResolvedValue(reply);

			const expectedProps = [
				'COUNT',
				1000,
				'BLOCK',
				1000,
				'STREAMS',
				...streams.map((stream) => stream.key),
				...streams.map((stream) => stream.id),
			];

			return { xreadBufferSpy, streams, expectedProps, redisAdapter };
		};

		it('should call redis xreadBuffer with correct values', async () => {
			const { xreadBufferSpy, streams, expectedProps, redisAdapter } = await setup();

			await redisAdapter.readStreams(streams);

			expect(xreadBufferSpy).toHaveBeenCalledWith(...expectedProps);
		});

		it('should return correct value', async () => {
			const { streams, redisAdapter } = await setup();

			const result = await redisAdapter.readStreams(streams);

			expect(result).toEqual([
				{
					name: '2',
					messages: [{ id: '2', message: { message: Buffer.from('value') } }],
				},
			]);
		});
	});

	describe('readMessagesFromStream', () => {
		const setup = async () => {
			const { redisAdapter, redis } = await buildParams();
			const xreadBufferSpy = jest.spyOn(redis, 'xreadBuffer');
			const computeRedisRoomStreamName = 'computeRedisRoomStreamName';

			const readBufferReply = xReadBufferReplyFactory.build();
			// @ts-ignore
			xreadBufferSpy.mockResolvedValue(readBufferReply);
			// @ts-ignore
			const id = readBufferReply[0][0].toString();

			const expectedProps = ['COUNT', 1000, 'BLOCK', 1000, 'STREAMS', computeRedisRoomStreamName, '0'];

			const expectedResult = [
				{
					name: id,
					messages: [{ id, message: { message: Buffer.from('value') } }],
				},
			];

			return { xreadBufferSpy, computeRedisRoomStreamName, expectedProps, expectedResult, redisAdapter };
		};

		it('should call redis xreadBuffer with correct values', async () => {
			const { xreadBufferSpy, computeRedisRoomStreamName, expectedProps, redisAdapter } = await setup();

			await redisAdapter.readMessagesFromStream(computeRedisRoomStreamName);

			expect(xreadBufferSpy).toHaveBeenCalledWith(...expectedProps);
		});

		it('should return correct value', async () => {
			const { computeRedisRoomStreamName, expectedResult, redisAdapter } = await setup();

			const result = await redisAdapter.readMessagesFromStream(computeRedisRoomStreamName);

			expect(result).toEqual(expectedResult);
		});
	});

	describe('reclaimTasks', () => {
		const setup = async () => {
			const { redisAdapter, redis } = await buildParams();
			const xautoclaimSpy = jest.spyOn(redis, 'xautoclaim');
			const consumer = 'consumer';
			const redisTaskDebounce = 1000;

			const returnValue = xAutoClaimRawReplyFactory.build();
			xautoclaimSpy.mockResolvedValue(returnValue);

			const expectedProps = [
				redisAdapter.redisWorkerStreamName,
				redisAdapter.redisWorkerGroupName,
				consumer,
				redisTaskDebounce,
				'0',
				'COUNT',
				5,
			];

			return { xautoclaimSpy, consumer, redisTaskDebounce, expectedProps, redisAdapter };
		};

		it('should call redis xautoclaim with correct values', async () => {
			const { xautoclaimSpy, consumer, redisTaskDebounce, expectedProps, redisAdapter } = await setup();

			await redisAdapter.reclaimTasks(consumer, redisTaskDebounce);

			expect(xautoclaimSpy).toHaveBeenCalledWith(...expectedProps);
		});

		it('should return correct value', async () => {
			const { consumer, redisTaskDebounce, redisAdapter } = await setup();

			const result = await redisAdapter.reclaimTasks(consumer, redisTaskDebounce);

			expect(result).toEqual({ nextId: '2', messages: [{ id: '2', message: { key: 'message' } }] });
		});
	});

	describe('markToDeleteByDocName', () => {
		const setup = async () => {
			const { redisAdapter, redis } = await buildParams();
			const docName = 'docName';
			const xaddSpy = jest.spyOn(redis, 'xadd');
			const publishSpy = jest.spyOn(redis, 'publish');

			const xaddExpectedProps = [redisAdapter.redisDeleteStreamName, '*', 'docName', docName];
			const publishExpectedProps = [redisAdapter.redisDeletionActionKey, docName];

			return { docName, xaddSpy, publishSpy, xaddExpectedProps, publishExpectedProps, redisAdapter };
		};

		it('should call redis xadd with correct values', async () => {
			const { docName, xaddSpy, xaddExpectedProps, redisAdapter } = await setup();

			await redisAdapter.markToDeleteByDocName(docName);

			expect(xaddSpy).toHaveBeenCalledWith(...xaddExpectedProps);
		});

		it('should call redis publish with correct values', async () => {
			const { docName, publishSpy, publishExpectedProps, redisAdapter } = await setup();

			await redisAdapter.markToDeleteByDocName(docName);

			expect(publishSpy).toHaveBeenCalledWith(...publishExpectedProps);
		});
	});

	describe('getDeletedDocEntries', () => {
		const setup = async () => {
			const { redisAdapter, redis } = await buildParams();
			const redisDeleteStreamName = `${testPrefix}:delete`;
			const xrangeBufferSpy = jest.spyOn(redis, 'xrangeBuffer');

			const xrangeBufferReply = xItemsBufferFactory.build();

			// @ts-ignore
			xrangeBufferSpy.mockResolvedValue(xrangeBufferReply);

			const [id, fields] = xrangeBufferReply[0];

			const expectedProps = [redisDeleteStreamName, '-', '+'];

			const expectedReturn = [
				{
					id: id.toString(),
					message: { message: fields[1] },
				},
			];

			return { xrangeBufferSpy, redisDeleteStreamName, expectedProps, expectedReturn, redisAdapter };
		};

		it('should call redis xrangeBuffer with correct values', async () => {
			const { xrangeBufferSpy, expectedProps, redisAdapter } = await setup();

			await redisAdapter.getDeletedDocEntries();

			expect(xrangeBufferSpy).toHaveBeenCalledWith(...expectedProps);
		});

		it('should return correct value', async () => {
			const { expectedReturn, redisAdapter } = await setup();

			const result = await redisAdapter.getDeletedDocEntries();

			expect(result).toEqual(expectedReturn);
		});
	});

	describe('deleteDeleteDocEntry', () => {
		const setup = async () => {
			const { redisAdapter, redis } = await buildParams();
			const id = '1728975844762-0';
			const xdelSpy = jest.spyOn(redis, 'xdel');

			xdelSpy.mockResolvedValue(1);

			const expectedProps = [redisAdapter.redisDeleteStreamName, id];

			return { id, xdelSpy, expectedProps, redisAdapter };
		};

		it('should call redis xdel with correct values', async () => {
			const { id, xdelSpy, expectedProps, redisAdapter } = await setup();

			await redisAdapter.deleteDeleteDocEntry(id);

			expect(xdelSpy).toHaveBeenCalledWith(...expectedProps);
		});

		it('should return correct value', async () => {
			const { id, redisAdapter } = await setup();

			const result = await redisAdapter.deleteDeleteDocEntry(id);

			expect(result).toBe(1);
		});
	});

	describe('tryClearTask', () => {
		const setup = async () => {
			const { redisAdapter, redis } = await buildParams();
			const xlenSpy = jest.spyOn(redis, 'xlen');
			const multiSpy = jest.spyOn(redis, 'multi');
			// @ts-ignore
			const xDelIfEmptySpy = jest.spyOn(redis, 'xDelIfEmpty');
			const xdelSpy = jest.spyOn(redis, 'xdel');
			const execSpy = jest.spyOn(redis, 'exec');

			xlenSpy.mockResolvedValue(0);
			// @ts-ignore
			multiSpy.mockReturnValue(redis);
			// @ts-ignore
			xDelIfEmptySpy.mockReturnValue(redis);
			// @ts-ignore
			xdelSpy.mockReturnValue(redis);
			// @ts-ignore
			execSpy.mockResolvedValue();

			const task = {
				stream: 'stream',
				id: 'id',
			};

			return { xlenSpy, xDelIfEmptySpy, multiSpy, task, xdelSpy, execSpy, redisAdapter };
		};

		it('should call redis xlen with correct values', async () => {
			const { xlenSpy, task, redisAdapter } = await setup();

			await redisAdapter.tryClearTask(task);

			expect(xlenSpy).toHaveBeenCalledWith(task.stream);
		});

		it('should call redis multi with correct values', async () => {
			const { multiSpy, redisAdapter } = await setup();

			await redisAdapter.tryClearTask({ stream: 'stream', id: 'id' });

			expect(multiSpy).toHaveBeenCalled();
		});

		it('should call redis xDelIfEmpty with correct values', async () => {
			const { xDelIfEmptySpy, task, redisAdapter } = await setup();

			await redisAdapter.tryClearTask(task);

			expect(xDelIfEmptySpy).toHaveBeenCalledWith(task.stream);
		});

		it('should call redis xdel with correct values', async () => {
			const { xdelSpy, task, redisAdapter } = await setup();

			await redisAdapter.tryClearTask(task);

			expect(xdelSpy).toHaveBeenCalledWith(redisAdapter.redisWorkerStreamName, task.id);
		});

		it('should call redis exec with correct values', async () => {
			const { execSpy, redisAdapter } = await setup();

			await redisAdapter.tryClearTask({ stream: 'stream', id: 'id' });

			expect(execSpy).toHaveBeenCalled();
		});

		it('should return correct value', async () => {
			const { task, redisAdapter } = await setup();

			const result = await redisAdapter.tryClearTask(task);

			expect(result).toBe(0);
		});
	});

	describe('tryDeduplicateTask', () => {
		const setup = async () => {
			const { redisAdapter, redis } = await buildParams();
			const multiSpy = jest.spyOn(redis, 'multi');
			const xtrimSpy = jest.spyOn(redis, 'xtrim');
			const xaddSpy = jest.spyOn(redis, 'xadd');
			const xreadgroupSpy = jest.spyOn(redis, 'xreadgroup');
			const xdelSpy = jest.spyOn(redis, 'xdel');
			const execSpy = jest.spyOn(redis, 'exec');

			// @ts-ignore
			multiSpy.mockReturnValue(redis);
			// @ts-ignore
			xtrimSpy.mockReturnValue(redis);
			// @ts-ignore
			xaddSpy.mockReturnValue(redis);
			// @ts-ignore
			xreadgroupSpy.mockReturnValue(redis);
			// @ts-ignore
			xdelSpy.mockReturnValue(redis);
			// @ts-ignore
			execSpy.mockResolvedValue();

			const task = {
				stream: 'stream',
				id: 'id',
			};

			return { multiSpy, xtrimSpy, xaddSpy, xreadgroupSpy, task, xdelSpy, execSpy, redisAdapter };
		};

		it('should call redis multi with correct values', async () => {
			const { multiSpy, task, redisAdapter } = await setup();

			await redisAdapter.tryDeduplicateTask(task, 0, 0);

			expect(multiSpy).toHaveBeenCalled();
		});

		it('should call redis xtrim with correct values', async () => {
			const { xtrimSpy, task, redisAdapter } = await setup();

			await redisAdapter.tryDeduplicateTask(task, 123, 1);

			expect(xtrimSpy).toHaveBeenCalledWith(task.stream, 'MINID', 122);
		});

		it('should call redis xadd with correct values', async () => {
			const { xaddSpy, task, redisAdapter } = await setup();

			await redisAdapter.tryDeduplicateTask(task, 0, 0);

			expect(xaddSpy).toHaveBeenCalledWith(redisAdapter.redisWorkerGroupName, '*', 'compact', task.stream);
		});

		it('should call redis xreadgroup with correct values', async () => {
			const { xreadgroupSpy, task, redisAdapter } = await setup();

			await redisAdapter.tryDeduplicateTask(task, 0, 0);
			expect(xreadgroupSpy).toHaveBeenCalledWith(
				'GROUP',
				redisAdapter.redisWorkerGroupName,
				'pending',
				'COUNT',
				50,
				'STREAMS',
				redisAdapter.redisWorkerStreamName,
				'>',
			);
		});

		it('should call redis xdel with correct values', async () => {
			const { xdelSpy, task, redisAdapter } = await setup();

			await redisAdapter.tryDeduplicateTask(task, 0, 0);

			expect(xdelSpy).toHaveBeenCalledWith(redisAdapter.redisWorkerStreamName, task.id);
		});

		it('should call redis exec with correct values', async () => {
			const { execSpy, redisAdapter } = await setup();

			await redisAdapter.tryDeduplicateTask({ stream: 'stream', id: 'id' }, 0, 0);

			expect(execSpy).toHaveBeenCalled();
		});
	});

	describe('quit', () => {
		it('should call redis quit with correct values', async () => {
			const { redisAdapter, redis } = await buildParams();
			const quitSpy = jest.spyOn(redis, 'quit');

			await redisAdapter.quit();

			expect(quitSpy).toHaveBeenCalled();
		});
	});
});
