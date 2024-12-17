import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '../logger/logger.js';
import { SubscriberService } from './subscriber.service.js';
import { yRedisMessageFactory } from './testing/y-redis-message.factory.js';
import { YRedisClient } from './y-redis.client.js';

describe('SubscriberService', () => {
	describe(SubscriberService.name, () => {
		let module: TestingModule;
		let service: SubscriberService;
		let yRedisClient: DeepMocked<YRedisClient>;

		beforeEach(async () => {
			module = await Test.createTestingModule({
				providers: [
					SubscriberService,
					{
						provide: YRedisClient,
						useValue: createMock<YRedisClient>(),
					},
					{
						provide: Logger,
						useValue: createMock<Logger>(),
					},
				],
			}).compile();

			service = module.get<SubscriberService>(SubscriberService);
			yRedisClient = module.get(YRedisClient);
		});

		afterEach(() => {
			jest.restoreAllMocks();
		});

		it('should be defined', () => {
			expect(service).toBeDefined();
		});

		describe('ensureSubId', () => {
			it('should update nextId when id is smaller', () => {
				const id = '1';
				const stream = 'test';

				service.subscribers.set(stream, { fs: new Set(), id: '2', nextId: null });

				service.ensureSubId(stream, id);

				expect(service.subscribers.get(stream)?.nextId).toEqual(id);
			});

			it('should not update nextId when id is not smaller', () => {
				const id = '3';
				const stream = 'test';

				service.subscribers.set(stream, { fs: new Set(), id: '2', nextId: null });

				service.ensureSubId(stream, id);

				expect(service.subscribers.get(stream)?.nextId).toBeNull();
			});
		});

		describe('subscribe', () => {
			describe('when stream is not present', () => {
				it('should add stream to subscribers', () => {
					const subscriptionHandler = jest.fn();

					service.subscribe('test', subscriptionHandler);

					expect(service.subscribers.size).toEqual(1);
				});

				it('should add subscription handler to stream', () => {
					const subscriptionHandler = jest.fn();

					service.subscribe('test', subscriptionHandler);

					expect(service.subscribers.get('test')?.fs.size).toEqual(1);
				});

				it('should have two subscribers', () => {
					const subscriptionHandler = jest.fn();

					service.subscribe('test', subscriptionHandler);

					expect(service.subscribers.size).toEqual(1);
					service.subscribe('test1', subscriptionHandler);
					expect(service.subscribers.size).toEqual(2);
				});

				it('should add stream to subscribers with next id as null', () => {
					const subscriptionHandler = jest.fn();

					service.subscribe('test', subscriptionHandler);

					expect(service.subscribers.get('test')?.nextId).toBeNull();
				});

				it('should add stream to subscribers with id as 0', () => {
					const subscriptionHandler = jest.fn();

					service.subscribe('test', subscriptionHandler);

					expect(service.subscribers.get('test')?.id).toEqual('0');
				});

				it('should add stream to subscribers with subscription handler', () => {
					const subscriptionHandler = jest.fn();

					service.subscribe('test', subscriptionHandler);

					expect(service.subscribers.get('test')?.fs.has(subscriptionHandler)).toBeTruthy();
				});

				it('should return correctly result', () => {
					const subscriptionHandler = jest.fn();

					const result = service.subscribe('test', subscriptionHandler);

					expect(result).toEqual({ redisId: '0' });
				});
			});
		});

		describe('unsubscribe', () => {
			describe('when stream is present', () => {
				it('should remove just once subscription handler from stream', () => {
					const subscriptionHandler = jest.fn();
					const subscriptionHandler1 = jest.fn();

					service.subscribe('test', subscriptionHandler);
					service.subscribe('test', subscriptionHandler1);
					service.unsubscribe('test', subscriptionHandler);

					expect(service.subscribers.get('test')?.fs.size).toEqual(1);
				});

				it('should remove stream from subscribers when fs size is 0', () => {
					const subscriptionHandler = jest.fn();

					service.subscribe('test', subscriptionHandler);
					service.unsubscribe('test', subscriptionHandler);

					expect(service.subscribers.size).toEqual(0);
				});
			});
		});

		describe('status', () => {
			describe('when running is true', () => {
				it('should return true', () => {
					expect(service.status()).toBeTruthy();
				});
			});

			describe('when running is false', () => {
				it('should return false', () => {
					service.stop();

					expect(service.status()).toBeFalsy();
				});
			});
		});

		describe('destroy', () => {
			it('should call client destroy', async () => {
				await service.onModuleDestroy();

				expect(yRedisClient.destroy).toHaveBeenCalled();
			});
		});

		describe('run', () => {
			const setupRun = () => {
				const subscriptionHandler = jest.fn();

				service.subscribe('test', subscriptionHandler);
				const messages = yRedisMessageFactory.build({ stream: 'test' });
				yRedisClient.getMessages.mockResolvedValue([messages]);

				return { subscriptionHandler };
			};

			it('should call client getMessages', async () => {
				setupRun();

				await service.run();

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
				setupRun();
				const messages = yRedisMessageFactory.buildList(3, { stream: 'test' });
				const spyGetSubscribers = jest.spyOn(service.subscribers, 'get');
				yRedisClient.getMessages.mockResolvedValueOnce(messages);

				await service.run();

				expect(spyGetSubscribers).toHaveBeenCalledTimes(3);
			});

			it('should call subscription handler', async () => {
				const { subscriptionHandler } = setupRun();
				const messages = yRedisMessageFactory.buildList(3, { stream: 'test' });
				yRedisClient.getMessages.mockResolvedValue(messages);

				await service.run();

				expect(subscriptionHandler).toHaveBeenCalledWith(messages[0].stream, messages[0].messages);
				expect(subscriptionHandler).toHaveBeenCalledWith(messages[1].stream, messages[1].messages);
				expect(subscriptionHandler).toHaveBeenCalledWith(messages[2].stream, messages[2].messages);
			});

			it('should skip subscription handler', async () => {
				const { subscriptionHandler } = setupRun();
				const messages = yRedisMessageFactory.buildList(3, { stream: 'skip' });
				yRedisClient.getMessages.mockResolvedValue(messages);

				await service.run();

				expect(subscriptionHandler).not.toHaveBeenCalled();
			});

			describe('when nextId is not null', () => {
				const setupRun = () => {
					const subscriptionHandler = jest.fn();

					service.subscribe('test', subscriptionHandler);
					const messages = yRedisMessageFactory.build({ stream: 'test' });
					yRedisClient.getMessages.mockResolvedValue([messages]);

					const testSubscriber = service.subscribers.get('test');
					if (testSubscriber) {
						testSubscriber.nextId = '1';
					}

					const expectedMessages = {
						nextId: null,
						id: '1',
					};

					return { yRedisClient, service, testSubscriber, expectedMessages };
				};

				it('should set id and nextId ', async () => {
					const { service, testSubscriber, expectedMessages } = setupRun();

					await service.run();

					expect(testSubscriber).toEqual(expect.objectContaining(expectedMessages));
				});
			});
		});
	});
});
