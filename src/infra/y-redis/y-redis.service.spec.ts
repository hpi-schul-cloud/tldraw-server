import { createMock } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { encoding } from 'lib0';
import { Awareness } from 'y-protocols/awareness';
import { Doc, encodeStateAsUpdate, encodeStateVector } from 'yjs';
import * as protocol from './protocol.js';
import { SubscriberService } from './subscriber.service.js';
import { yRedisDocFactory } from './testing/y-redis-doc.factory.js';
import { yRedisUserFactory } from './testing/y-redis-user.factory.js';
import { YRedisService } from './y-redis.service.js';

const buildUpdate = (props: {
	messageType: number;
	length: number;
	numberOfUpdates: number;
	awarenessId: number;
	lastClock: number;
}): Buffer => {
	const { messageType, length, numberOfUpdates, awarenessId, lastClock } = props;
	const encoder = encoding.createEncoder();
	encoding.writeVarUint(encoder, messageType);
	encoding.writeVarUint(encoder, length);
	encoding.writeVarUint(encoder, numberOfUpdates);
	encoding.writeVarUint(encoder, awarenessId);
	encoding.writeVarUint(encoder, lastClock);

	return Buffer.from(encoding.toUint8Array(encoder));
};

describe(YRedisService.name, () => {
	let module: TestingModule;
	let yRedisService: YRedisService;
	let subscriberService: SubscriberService;

	beforeEach(async () => {
		module = await Test.createTestingModule({
			providers: [
				YRedisService,
				{
					provide: SubscriberService,
					useValue: createMock<SubscriberService>(),
				},
			],
		}).compile();

		yRedisService = module.get(YRedisService);
		subscriberService = module.get(SubscriberService);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('should be defined', () => {
		expect(yRedisService).toBeDefined();
	});

	describe('SubscriberService wrap methods', () => {
		const setup = () => {
			const stream = 'test';
			const callback = jest.fn();

			return { stream, callback };
		};

		it('should call subscriberService.start', () => {
			yRedisService.start();

			expect(subscriberService.start).toHaveBeenCalled();
		});

		it('should call subscriberService.subscribe', () => {
			const { stream, callback } = setup();

			yRedisService.subscribe(stream, callback);

			expect(subscriberService.subscribe).toHaveBeenCalledWith(stream, callback);
		});

		it('should call subscriberService.unsubscribe', () => {
			const { stream, callback } = setup();

			yRedisService.unsubscribe(stream, callback);

			expect(subscriberService.unsubscribe).toHaveBeenCalledWith(stream, callback);
		});

		describe('when isSmallerRedisId returns true', () => {
			const setup = () => {
				const yRedisDoc = yRedisDocFactory.build({ redisLastId: '0' });
				const yRedisUser = yRedisUserFactory.build({ initialRedisSubId: '1' });

				return { yRedisDoc, yRedisUser };
			};

			it('should call subscriberService.ensureSubId', () => {
				const { yRedisDoc, yRedisUser } = setup();

				yRedisService.ensureLatestContentSubscription(yRedisDoc, yRedisUser);

				expect(subscriberService.ensureSubId).toHaveBeenCalledWith(yRedisDoc.streamName, yRedisDoc.redisLastId);
			});
		});

		describe('when isSmallerRedisId returns false', () => {
			const setup = () => {
				const yRedisDoc = yRedisDocFactory.build({ redisLastId: '1' });
				const yRedisUser = yRedisUserFactory.build({ initialRedisSubId: '0' });

				return { yRedisDoc, yRedisUser };
			};

			it('should call subscriberService.ensureSubId', () => {
				const { yRedisDoc, yRedisUser } = setup();

				yRedisService.ensureLatestContentSubscription(yRedisDoc, yRedisUser);

				expect(subscriberService.ensureSubId).not.toHaveBeenCalledWith(yRedisDoc.streamName, yRedisDoc.redisLastId);
			});
		});
	});

	describe('filterMessageForPropagation', () => {
		describe('when message is awareness update and users awarenessid is null', () => {
			const setup = () => {
				const user = yRedisUserFactory.build({
					awarenessId: null,
					awarenessLastClock: 99,
				});
				const messageBuffer = buildUpdate({
					messageType: protocol.messageAwareness,
					length: 0,
					numberOfUpdates: 1,
					awarenessId: 75,
					lastClock: 76,
				});

				return { messageBuffer, user };
			};

			it('should update users awarenessId and awarenessLastClock', () => {
				const { messageBuffer, user } = setup();

				yRedisService.filterMessageForPropagation(messageBuffer, user);

				expect(user.awarenessId).toBe(75);
				expect(user.awarenessLastClock).toBe(76);
			});

			it('should return message', () => {
				const { messageBuffer, user } = setup();

				const result = yRedisService.filterMessageForPropagation(messageBuffer, user);

				expect(result).toEqual(Buffer.from(messageBuffer));
			});
		});

		describe('when message is awareness update and users awarenessid is messages awarenessid', () => {
			const setup = () => {
				const user = yRedisUserFactory.build({
					awarenessId: 75,
					awarenessLastClock: 99,
				});

				const messageBuffer = buildUpdate({
					messageType: protocol.messageAwareness,
					length: 0,
					numberOfUpdates: 1,
					awarenessId: 75,
					lastClock: 76,
				});

				return { messageBuffer, user };
			};

			it('should update users awarenessId and awarenessLastClock', () => {
				const { messageBuffer, user } = setup();

				yRedisService.filterMessageForPropagation(messageBuffer, user);

				expect(user.awarenessId).toBe(75);
				expect(user.awarenessLastClock).toBe(76);
			});
		});

		describe('when message is sync update', () => {
			const setup = () => {
				const user = yRedisUserFactory.build({
					awarenessId: null,
					awarenessLastClock: 99,
				});

				const messageBuffer = buildUpdate({
					messageType: protocol.messageSync,
					length: protocol.messageSyncUpdate,
					numberOfUpdates: 1,
					awarenessId: 75,
					lastClock: 76,
				});

				return { messageBuffer, user };
			};

			it('should not update users awarenessId and awarenessLastClock', () => {
				const { messageBuffer, user } = setup();

				yRedisService.filterMessageForPropagation(messageBuffer, user);

				expect(user.awarenessId).toBe(null);
				expect(user.awarenessLastClock).toBe(99);
			});
		});

		describe('when message is sync step 2 update', () => {
			const setup = () => {
				const user = yRedisUserFactory.build({
					awarenessId: null,
					awarenessLastClock: 99,
				});

				const messageBuffer = buildUpdate({
					messageType: protocol.messageSync,
					length: protocol.messageSyncStep2,
					numberOfUpdates: 1,
					awarenessId: 75,
					lastClock: 76,
				});

				return { messageBuffer, user };
			};

			it('should not update users awarenessId and awarenessLastClock', () => {
				const { messageBuffer, user } = setup();

				yRedisService.filterMessageForPropagation(messageBuffer, user);

				expect(user.awarenessId).toBe(null);
				expect(user.awarenessLastClock).toBe(99);
			});
		});

		describe('when message is sync step 1 update', () => {
			const setup = () => {
				const user = yRedisUserFactory.build({
					awarenessId: null,
					awarenessLastClock: 99,
				});

				const messageBuffer = buildUpdate({
					messageType: protocol.messageSync,
					length: protocol.messageSyncStep1,
					numberOfUpdates: 1,
					awarenessId: 75,
					lastClock: 76,
				});

				return { messageBuffer, user };
			};

			it('should not update users awarenessId and awarenessLastClock', () => {
				const { messageBuffer, user } = setup();

				yRedisService.filterMessageForPropagation(messageBuffer, user);

				expect(user.awarenessId).toBe(null);
				expect(user.awarenessLastClock).toBe(99);
			});

			it('should return null', () => {
				const { messageBuffer, user } = setup();

				const result = yRedisService.filterMessageForPropagation(messageBuffer, user);

				expect(result).toBe(null);
			});
		});

		describe('when message is of unknown type', () => {
			const setup = () => {
				const user = yRedisUserFactory.build({
					awarenessId: null,
					awarenessLastClock: 99,
				});

				const messageBuffer = buildUpdate({
					messageType: 999,
					length: 999,
					numberOfUpdates: 1,
					awarenessId: 75,
					lastClock: 76,
				});

				return { messageBuffer, user };
			};

			it('should throw an error', () => {
				const { messageBuffer, user } = setup();

				expect(() => yRedisService.filterMessageForPropagation(messageBuffer, user)).toThrow(
					`Unexpected message type ${messageBuffer}`,
				);
			});
		});
	});

	describe('createAwarenessUserDisconnectedMessage', () => {
		describe('when awarenessId is null', () => {
			it('should throw an error', () => {
				const user = yRedisUserFactory.build({ awarenessId: null });

				expect(() => yRedisService.createAwarenessUserDisconnectedMessage(user)).toThrow(
					'Missing awarenessId in YRedisUser.',
				);
			});
		});

		describe('when awarenessId is not null', () => {
			const setup = () => {
				const user = yRedisUserFactory.build({ awarenessId: 1 });

				const expected = Buffer.from(protocol.encodeAwarenessUserDisconnected(1, 0));

				return { user, expected };
			};

			it('should return a buffer', () => {
				const { user, expected } = setup();
				const result = yRedisService.createAwarenessUserDisconnectedMessage(user);

				expect(result).toEqual(expected);
			});
		});

		describe('encodeSyncStep1StateVectorMessage', () => {
			const setup = () => {
				const yDoc = new Doc();

				const expected = protocol.encodeSyncStep1(encodeStateVector(yDoc));

				return { yDoc, expected };
			};

			it('should return a buffer', () => {
				const { yDoc, expected } = setup();
				const result = yRedisService.encodeSyncStep1StateVectorMessage(yDoc);

				expect(result).toEqual(expected);
			});
		});

		describe('encodeSyncStep2StateAsUpdateMessage', () => {
			const setup = () => {
				const yDoc = new Doc();

				const expected = protocol.encodeSyncStep2(encodeStateAsUpdate(yDoc));

				return { yDoc, expected };
			};

			it('should return a buffer', () => {
				const { yDoc, expected } = setup();
				const result = yRedisService.encodeSyncStep2StateAsUpdateMessage(yDoc);

				expect(result).toEqual(expected);
			});
		});

		describe('encodeAwarenessUpdateMessage', () => {
			const setup = () => {
				const awareness = new Awareness(new Doc());

				const expected = protocol.encodeAwarenessUpdate(awareness, Array.from(awareness.states.keys()));

				return { awareness, expected };
			};

			it('should return a buffer', () => {
				const { awareness, expected } = setup();
				const result = yRedisService.encodeAwarenessUpdateMessage(awareness);

				expect(result).toEqual(expected);

				awareness.destroy();
			});
		});

		describe('mergeMessagesToMessage', () => {
			describe('when messages length is 1', () => {
				const setup = () => {
					const messages = [Buffer.from('hello')];

					const expected = messages[0];

					return { messages, expected };
				};

				it('should return a buffer', () => {
					const { messages, expected } = setup();
					const result = yRedisService.mergeMessagesToMessage(messages);

					expect(result).toEqual(expected);
				});
			});

			describe('when messages length greater than 1', () => {
				const setup = () => {
					const messages = [Buffer.from('hello'), Buffer.from('world')];

					const expected = encoding.encode((encoder) => {
						messages.forEach((message) => {
							encoding.writeUint8Array(encoder, message);
						});
					});

					return { messages, expected };
				};

				it('should return a buffer', () => {
					const { messages, expected } = setup();
					const result = yRedisService.mergeMessagesToMessage(messages);

					expect(result).toEqual(expected);
				});
			});
		});
	});
});
