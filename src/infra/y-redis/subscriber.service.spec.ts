jest.mock('./api.service.js', () => {
	return {
		Api: jest.fn().mockImplementation(() => {
			return {
				prototype: jest.fn(),
			};
		}),
	};
});

import { createMock } from '@golevelup/ts-jest';
import type { Api } from './api.service.js';
import { Subscriber } from './subscriber.service.js';

describe(Subscriber.name, () => {
	const setup = () => {
		const api = createMock<Api>();
		const subscriber = new Subscriber(api);

		return { subscriber, api };
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

	it('should subscribe', () => {
		const { subscriber } = setup();
		const subscriptionHandler = jest.fn();

		subscriber.subscribe('test', () => subscriptionHandler);

		expect(subscriber.subscribers.size).toEqual(1);
		subscriber.subscribe('test1', () => subscriptionHandler);
		expect(subscriber.subscribers.size).toEqual(2);
	});
});
