import { createMock } from '@golevelup/ts-jest';
import { YRedisClient } from './y-redis.client.js';
import * as subscriberService from './subscriber.service.js';
import { yRedisMessageFactory } from './testing/y-redis-message.factory.js';

describe('SubscriberService', () => {
	/*describe('run', () => {
		let callCount = 0;

		beforeEach(() => {
			callCount = 0;
		});

		const setup = () => {
			const subscriber = createMock<subscriberService.Subscriber>({
				run: jest.fn(),
			});

			Object.defineProperty(subscriberService, 'running', {
				get: () => {
					if (callCount === 0) {
						callCount++;

						return true;
					}

					return false;
				},
			});

			return { subscriber };
		};

		it('should call subscriber.run', async () => {
			const { subscriber } = setup();

			await subscriberService.run(subscriber);

			expect(subscriber.run).toHaveBeenCalled();
		});
	});*/

	/*	describe('createSubscriber', () => {
		const setup = () => {
			const store = createMock<DocumentStorage>();
			const createRedisInstance = createMock<RedisService>();

			const runSpy = jest.spyOn(subscriberService, 'run').mockResolvedValue();

			return { store, createRedisInstance, runSpy };
		};

		it('should call run', async () => {
			const { store, createRedisInstance, runSpy } = setup();

			await subscriberService.createSubscriber(store, createRedisInstance);

			expect(runSpy).toHaveBeenCalled();
		});

		it('should return subscriber', async () => {
			const { store, createRedisInstance } = setup();

			const subscriber = await subscriberService.createSubscriber(store, createRedisInstance);

			expect(subscriber).toBeDefined();
			expect(subscriber).toBeInstanceOf(subscriberService.Subscriber);
		});
	});*/

	describe(subscriberService.Subscriber.name, () => {
		const setup = () => {
			const yRedisClient = createMock<YRedisClient>();
			const subscriber = new subscriberService.Subscriber(yRedisClient); // TODO

			return { subscriber, yRedisClient };
		};

		it('should be defined', () => {
			const { subscriber } = setup();

			expect(subscriber).toBeDefined();
		});

		describe('ensureSubId', () => {
			it('should update nextId when id is smaller', () => {
				const { subscriber } = setup();
				const id = '1';
				const stream = 'test';

				subscriber.subscribers.set(stream, { fs: new Set(), id: '2', nextId: null });

				subscriber.ensureSubId(stream, id);

				expect(subscriber.subscribers.get(stream)?.nextId).toEqual(id);
			});

			it('should not update nextId when id is not smaller', () => {
				const { subscriber } = setup();
				const id = '3';
				const stream = 'test';

				subscriber.subscribers.set(stream, { fs: new Set(), id: '2', nextId: null });

				subscriber.ensureSubId(stream, id);

				expect(subscriber.subscribers.get(stream)?.nextId).toBeNull();
			});
		});

		describe('subscribe', () => {
			describe('when stream is not present', () => {
				it('should add stream to subscribers', () => {
					const { subscriber } = setup();
					const subscriptionHandler = jest.fn();

					subscriber.subscribe('test', subscriptionHandler);

					expect(subscriber.subscribers.size).toEqual(1);
				});

				it('should add subscription handler to stream', () => {
					const { subscriber } = setup();
					const subscriptionHandler = jest.fn();

					subscriber.subscribe('test', subscriptionHandler);

					expect(subscriber.subscribers.get('test')?.fs.size).toEqual(1);
				});

				it('should have many subscriber', () => {
					const { subscriber } = setup();
					const subscriptionHandler = jest.fn();

					subscriber.subscribe('test', subscriptionHandler);

					expect(subscriber.subscribers.size).toEqual(1);
					subscriber.subscribe('test1', subscriptionHandler);
					expect(subscriber.subscribers.size).toEqual(2);
				});

				it('should add stream to subscribers with next id as null', () => {
					const { subscriber } = setup();
					const subscriptionHandler = jest.fn();

					subscriber.subscribe('test', subscriptionHandler);

					expect(subscriber.subscribers.get('test')?.nextId).toBeNull();
				});

				it('should add stream to subscribers with id as 0', () => {
					const { subscriber } = setup();
					const subscriptionHandler = jest.fn();

					subscriber.subscribe('test', subscriptionHandler);

					expect(subscriber.subscribers.get('test')?.id).toEqual('0');
				});

				it('should add stream to subscribers with subscription handler', () => {
					const { subscriber } = setup();
					const subscriptionHandler = jest.fn();

					subscriber.subscribe('test', subscriptionHandler);

					expect(subscriber.subscribers.get('test')?.fs.has(subscriptionHandler)).toBeTruthy();
				});

				it('should return correctly result', () => {
					const { subscriber } = setup();
					const subscriptionHandler = jest.fn();

					const result = subscriber.subscribe('test', subscriptionHandler);

					expect(result).toEqual({ redisId: '0' });
				});
			});
		});

		describe('unsubscribe', () => {
			describe('when stream is present', () => {
				it('should remove just once subscription handler from stream', () => {
					const { subscriber } = setup();
					const subscriptionHandler = jest.fn();
					const subscriptionHandler1 = jest.fn();

					subscriber.subscribe('test', subscriptionHandler);
					subscriber.subscribe('test', subscriptionHandler1);
					subscriber.unsubscribe('test', subscriptionHandler);

					expect(subscriber.subscribers.get('test')?.fs.size).toEqual(1);
				});

				it('should remove stream from subscribers when fs size is 0', () => {
					const { subscriber } = setup();
					const subscriptionHandler = jest.fn();

					subscriber.subscribe('test', subscriptionHandler);
					subscriber.unsubscribe('test', subscriptionHandler);

					expect(subscriber.subscribers.size).toEqual(0);
				});
			});
		});

		describe('destroy', () => {
			it('should call client destroy', async () => {
				const { subscriber, yRedisClient } = setup();

				await subscriber.destroy();

				expect(yRedisClient.destroy).toHaveBeenCalled();
			});
		});

		describe('run', () => {
			const setupRun = () => {
				const { yRedisClient, subscriber } = setup();
				const subscriptionHandler = jest.fn();

				subscriber.subscribe('test', subscriptionHandler);

				return { yRedisClient, subscriber, subscriptionHandler };
			};

			it('should call client getMessages', async () => {
				const { yRedisClient, subscriber } = setupRun();

				await subscriber.run();

				expect(yRedisClient.getMessages).toHaveBeenCalledWith(
					expect.arrayContaining([
						{
							key: expect.any(String),
							id: expect.any(String),
						},
					]),
				);
			});

			it('should call subscription handler', async () => {
				const { yRedisClient, subscriber } = setupRun();
				const messages = yRedisMessageFactory.buildList(3, { stream: 'test' });
				const spyGetSubscribers = jest.spyOn(subscriber.subscribers, 'get');
				yRedisClient.getMessages.mockResolvedValueOnce(messages);

				await subscriber.run();

				expect(spyGetSubscribers).toHaveBeenCalledTimes(3);
			});

			it('should call subscription handler', async () => {
				const { yRedisClient, subscriber, subscriptionHandler } = setupRun();
				const messages = yRedisMessageFactory.buildList(3, { stream: 'test' });
				yRedisClient.getMessages.mockResolvedValue(messages);

				await subscriber.run();

				expect(subscriptionHandler).toHaveBeenCalledWith(messages[0].stream, messages[0].messages);
				expect(subscriptionHandler).toHaveBeenCalledWith(messages[1].stream, messages[1].messages);
				expect(subscriptionHandler).toHaveBeenCalledWith(messages[2].stream, messages[2].messages);
			});

			it('should skip subscription handler', async () => {
				const { yRedisClient, subscriber, subscriptionHandler } = setupRun();
				const messages = yRedisMessageFactory.buildList(3, { stream: 'skip' });
				yRedisClient.getMessages.mockResolvedValue(messages);

				await subscriber.run();

				expect(subscriptionHandler).not.toHaveBeenCalled();
			});

			describe('when nextId is not null', () => {
				const setupRun = () => {
					const { yRedisClient, subscriber } = setup();
					const subscriptionHandler = jest.fn();

					subscriber.subscribe('test', subscriptionHandler);
					const messages = yRedisMessageFactory.build({ stream: 'test' });
					yRedisClient.getMessages.mockResolvedValue([messages]);

					const testSubscriber = subscriber.subscribers.get('test');
					if (testSubscriber) {
						testSubscriber.nextId = '1';
					}

					const expectedMessages = {
						nextId: null,
						id: '1',
					};

					return { yRedisClient, subscriber, testSubscriber, expectedMessages };
				};

				it('should set id and nextId ', async () => {
					const { subscriber, testSubscriber, expectedMessages } = setupRun();

					await subscriber.run();

					expect(testSubscriber).toEqual(expect.objectContaining(expectedMessages));
				});
			});
		});
	});
});
