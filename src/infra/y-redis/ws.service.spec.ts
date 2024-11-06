import { createMock } from '@golevelup/ts-jest';
import * as uws from 'uws';
import { Awareness } from 'y-protocols/awareness.js';
import * as Y from 'yjs';
import { RedisService } from '../redis/redis.service.js';
import { Api } from './api.service.js';
import { computeRedisRoomStreamName } from './helper.js';
import * as protocol from './protocol.js';
import { DocumentStorage } from './storage.js';
import { Subscriber } from './subscriber.service.js';
import { openCallback, registerYWebsocketServer, upgradeCallback, User, YWebsocketServer } from './ws.service.js';

describe('ws service', () => {
	beforeEach(() => {
		jest.resetAllMocks();
	});

	describe('registerYWebsocketServer', () => {
		const buildParams = () => {
			const app = createMock<uws.TemplatedApp>();
			const pattern = 'pattern';
			const store = createMock<DocumentStorage>();
			const checkAuth = jest.fn();
			const options = {};
			const createRedisInstance = createMock<RedisService>();

			return { app, pattern, store, checkAuth, options, createRedisInstance };
		};

		it('returns YWebsocketServer', async () => {
			const { app, pattern, store, checkAuth, options, createRedisInstance } = buildParams();

			const result = await registerYWebsocketServer(app, pattern, store, checkAuth, options, createRedisInstance);

			expect(result).toEqual(expect.any(YWebsocketServer));
		});
	});

	describe('upgradeCallback', () => {
		describe('when aborted is emitted from response', () => {
			it('should return', async () => {
				const res = createMock<uws.HttpResponse>();
				const req = createMock<uws.HttpRequest>();
				const context = createMock<uws.us_socket_context_t>();
				const checkAuth = jest.fn();

				await upgradeCallback(res, req, context, checkAuth);

				res.aborted();

				expect(res.upgrade).not.toHaveBeenCalled();
			});
		});

		describe('when checkAuth rejects', () => {
			it('should return 500 Internal Server Error', async () => {
				const res = createMock<uws.HttpResponse>();
				const req = createMock<uws.HttpRequest>();
				const context = createMock<uws.us_socket_context_t>();
				const checkAuth = jest.fn().mockRejectedValue(new Error('error'));
				res.writeStatus.mockImplementationOnce(() => res);

				await upgradeCallback(res, req, context, checkAuth);

				expect(res.cork).toHaveBeenCalledTimes(1);
				expect(res.cork).toHaveBeenCalledWith(expect.any(Function));
				res.cork.mock.calls[0][0]();
				expect(res.writeStatus).toHaveBeenCalledWith('500 Internal Server Error');
				expect(res.end).toHaveBeenCalledWith('Internal Server Error');
			});
		});

		describe('when checkAuth resolves ', () => {
			it('should upgrade the connection', async () => {
				const res = createMock<uws.HttpResponse>();
				const req = createMock<uws.HttpRequest>();
				const context = createMock<uws.us_socket_context_t>();
				const checkAuth = jest.fn().mockResolvedValue({ hasWriteAccess: true, room: 'room', userid: 'userid' });

				await upgradeCallback(res, req, context, checkAuth);

				expect(res.cork).toHaveBeenCalledTimes(1);
				expect(res.cork).toHaveBeenCalledWith(expect.any(Function));
				res.cork.mock.calls[0][0]();
				expect(res.upgrade).toHaveBeenCalledWith(
					expect.objectContaining({
						awarenessId: null,
						awarenessLastClock: 0,
						error: null,
						hasWriteAccess: true,
						id: 0,
						initialRedisSubId: '0',
						isClosed: false,
						room: 'room',
						userid: 'userid',
					}),
					req.getHeader('sec-websocket-key'),
					req.getHeader('sec-websocket-protocol'),
					req.getHeader('sec-websocket-extensions'),
					context,
				);
			});
		});
	});

	describe('openCallback', () => {
		const buildParams = () => {
			const ws = createMock<uws.WebSocket<User>>();
			const subscriber = createMock<Subscriber>();
			const client = createMock<Api>({ redisPrefix: 'prefix' });
			const redisMessageSubscriber = jest.fn();
			const openWsCallback = jest.fn();
			const initDocCallback = jest.fn();

			return { ws, subscriber, client, redisMessageSubscriber, openWsCallback, initDocCallback };
		};

		it('should call getUserData', async () => {
			const { ws, subscriber, client, redisMessageSubscriber } = buildParams();

			await openCallback(ws, subscriber, client, redisMessageSubscriber);

			expect(ws.getUserData).toHaveBeenCalledTimes(1);
		});

		describe('when user has error property', () => {
			const setup = () => {
				const { ws, subscriber, client, redisMessageSubscriber, openWsCallback, initDocCallback } = buildParams();

				const code = 111;
				const reason = 'reason';
				const user = createMock<User>({ error: { code, reason } });
				ws.getUserData.mockReturnValue(user);

				return { ws, subscriber, client, redisMessageSubscriber, openWsCallback, initDocCallback, code, reason };
			};

			it('should call ws.end', async () => {
				const { ws, subscriber, client, redisMessageSubscriber, openWsCallback, initDocCallback, code, reason } =
					setup();

				await openCallback(ws, subscriber, client, redisMessageSubscriber, openWsCallback, initDocCallback);

				expect(ws.end).toHaveBeenCalledWith(code, reason);
			});

			it('should not call openWsCallback', async () => {
				const { ws, subscriber, client, redisMessageSubscriber, openWsCallback, initDocCallback } = setup();

				await openCallback(ws, subscriber, client, redisMessageSubscriber, openWsCallback, initDocCallback);

				expect(openWsCallback).not.toHaveBeenCalled();
			});
		});

		describe('when users room property is null', () => {
			const setup = () => {
				const { ws, subscriber, client, redisMessageSubscriber, openWsCallback, initDocCallback } = buildParams();

				const user = createMock<User>({ room: null, error: null });
				ws.getUserData.mockReturnValue(user);

				return { ws, subscriber, client, redisMessageSubscriber, openWsCallback, initDocCallback };
			};

			it('should call ws.end', async () => {
				const { ws, subscriber, client, redisMessageSubscriber, openWsCallback, initDocCallback } = setup();

				await openCallback(ws, subscriber, client, redisMessageSubscriber, openWsCallback, initDocCallback);

				expect(ws.end).toHaveBeenCalledWith(1008);
			});

			it('should not call openWsCallback', async () => {
				const { ws, subscriber, client, redisMessageSubscriber, openWsCallback, initDocCallback } = setup();

				await openCallback(ws, subscriber, client, redisMessageSubscriber, openWsCallback, initDocCallback);

				expect(openWsCallback).not.toHaveBeenCalled();
			});
		});

		describe('when users userid property is null', () => {
			const setup = () => {
				const { ws, subscriber, client, redisMessageSubscriber, openWsCallback, initDocCallback } = buildParams();

				const user = createMock<User>({ userid: null, error: null });
				ws.getUserData.mockReturnValue(user);

				return { ws, subscriber, client, redisMessageSubscriber, openWsCallback, initDocCallback };
			};

			it('should call ws.end', async () => {
				const { ws, subscriber, client, redisMessageSubscriber, openWsCallback, initDocCallback } = setup();

				await openCallback(ws, subscriber, client, redisMessageSubscriber, openWsCallback, initDocCallback);

				expect(ws.end).toHaveBeenCalledWith(1008);
			});

			it('should not call openWsCallback', async () => {
				const { ws, subscriber, client, redisMessageSubscriber, openWsCallback, initDocCallback } = setup();

				await openCallback(ws, subscriber, client, redisMessageSubscriber, openWsCallback, initDocCallback);

				expect(openWsCallback).not.toHaveBeenCalled();
			});
		});

		describe('when user has room and no error and is not closed', () => {
			const setup = () => {
				const { ws, subscriber, client, redisMessageSubscriber, openWsCallback, initDocCallback } = buildParams();

				const user = createMock<User>({ error: null, room: 'room', isClosed: false });
				ws.getUserData.mockReturnValue(user);

				const redisStream = computeRedisRoomStreamName(user.room ?? '', 'index', client.redisPrefix);

				return { ws, subscriber, client, user, redisStream, redisMessageSubscriber, openWsCallback, initDocCallback };
			};

			it('should call openWsCallback', async () => {
				const { ws, subscriber, client, redisMessageSubscriber, openWsCallback, initDocCallback } = setup();

				await openCallback(ws, subscriber, client, redisMessageSubscriber, openWsCallback, initDocCallback);

				expect(openWsCallback).toHaveBeenCalledWith(ws);
			});

			it('should add stream to user subscriptions', async () => {
				const { ws, subscriber, client, user, redisStream, redisMessageSubscriber, openWsCallback, initDocCallback } =
					setup();

				await openCallback(ws, subscriber, client, redisMessageSubscriber, openWsCallback, initDocCallback);

				expect(user.subs.add).toHaveBeenCalledWith(redisStream);
			});

			it('should subscribe ws to stream', async () => {
				const { ws, subscriber, client, redisStream, redisMessageSubscriber, openWsCallback, initDocCallback } =
					setup();

				await openCallback(ws, subscriber, client, redisMessageSubscriber, openWsCallback, initDocCallback);

				expect(ws.subscribe).toHaveBeenCalledWith(redisStream);
			});

			it('should subscribe subscriber to stream', async () => {
				const { ws, subscriber, client, redisStream, redisMessageSubscriber, openWsCallback, initDocCallback } =
					setup();

				await openCallback(ws, subscriber, client, redisMessageSubscriber, openWsCallback, initDocCallback);

				expect(subscriber.subscribe).toHaveBeenCalledWith(redisStream, redisMessageSubscriber);
			});

			it('should get doc from client', async () => {
				const { ws, subscriber, client, user, redisMessageSubscriber, openWsCallback, initDocCallback } = setup();

				await openCallback(ws, subscriber, client, redisMessageSubscriber, openWsCallback, initDocCallback);

				expect(client.getDoc).toHaveBeenCalledWith(user.room, 'index');
			});

			describe('when getDoc rejects', () => {
				it('should call ws.end', async () => {
					const { ws, subscriber, client, redisMessageSubscriber, openWsCallback, initDocCallback } = setup();
					client.getDoc.mockRejectedValue(new Error('error'));

					await openCallback(ws, subscriber, client, redisMessageSubscriber, openWsCallback, initDocCallback);

					expect(ws.end).toHaveBeenCalledWith(1011);
				});
			});

			describe('when getDoc resolves with ydoc.store.clients.size 0', () => {
				it('should call initDocCallback', async () => {
					const { ws, subscriber, client, user, redisMessageSubscriber, openWsCallback, initDocCallback } = setup();
					const ydoc = createMock<Y.Doc>({ store: { clients: { size: 0 } } });
					const awareness = createMock<Awareness>();
					client.getDoc.mockResolvedValueOnce({
						ydoc,
						awareness,
						redisLastId: '0',
						storeReferences: [],
						docChanged: true,
					});

					await openCallback(ws, subscriber, client, redisMessageSubscriber, openWsCallback, initDocCallback);

					expect(initDocCallback).toHaveBeenCalledWith(user.room, 'index', client);
				});

				describe('when ydoc.awareness.states.size > 0', () => {
					it('should call ws.cork', async () => {
						const { ws, subscriber, client, redisMessageSubscriber } = setup();
						const ydoc = createMock<Y.Doc>({ store: { clients: { size: 0 } } });
						const awareness = createMock<Awareness>({ states: new Map([['1', '1']]) });
						client.getDoc.mockResolvedValueOnce({
							ydoc,
							awareness,
							redisLastId: '0',
							storeReferences: [],
							docChanged: true,
						});
						const encodedArray = new Uint8Array([1, 2, 3]);
						jest.spyOn(protocol, 'encodeSyncStep1').mockReturnValueOnce(encodedArray);
						jest.spyOn(Y, 'encodeStateVector').mockReturnValueOnce(encodedArray);
						jest.spyOn(protocol, 'encodeSyncStep2').mockReturnValueOnce(encodedArray);
						jest.spyOn(Y, 'encodeStateAsUpdate').mockReturnValueOnce(encodedArray);
						jest.spyOn(protocol, 'encodeAwarenessUpdate').mockReturnValueOnce(encodedArray);

						await openCallback(ws, subscriber, client, redisMessageSubscriber);

						expect(ws.cork).toHaveBeenCalledTimes(1);
						expect(ws.cork).toHaveBeenCalledWith(expect.any(Function));
						ws.cork.mock.calls[0][0]();
						expect(ws.send).toHaveBeenNthCalledWith(1, encodedArray, true, false);
						expect(ws.send).toHaveBeenNthCalledWith(2, encodedArray, true, true);
						expect(ws.send).toHaveBeenNthCalledWith(3, encodedArray, true, true);
					});
				});

				describe('when ydoc.awareness.states.size = 0', () => {
					it('should call ws.cork', async () => {
						const { ws, subscriber, client, redisMessageSubscriber } = setup();
						const ydoc = createMock<Y.Doc>({ store: { clients: { size: 0 } } });
						const awareness = createMock<Awareness>({ states: new Map([]) });
						client.getDoc.mockResolvedValueOnce({
							ydoc,
							awareness,
							redisLastId: '0',
							storeReferences: [],
							docChanged: true,
						});
						const encodedArray = new Uint8Array([1, 2, 3]);
						jest.spyOn(protocol, 'encodeSyncStep1').mockReturnValueOnce(encodedArray);
						jest.spyOn(Y, 'encodeStateVector').mockReturnValueOnce(encodedArray);
						jest.spyOn(protocol, 'encodeSyncStep2').mockReturnValueOnce(encodedArray);
						jest.spyOn(Y, 'encodeStateAsUpdate').mockReturnValueOnce(encodedArray);
						jest.spyOn(protocol, 'encodeAwarenessUpdate').mockReturnValueOnce(encodedArray);

						await openCallback(ws, subscriber, client, redisMessageSubscriber);

						expect(ws.cork).toHaveBeenCalledTimes(1);
						expect(ws.cork).toHaveBeenCalledWith(expect.any(Function));
						ws.cork.mock.calls[0][0]();
						expect(ws.send).toHaveBeenCalledTimes(2);
						expect(ws.send).toHaveBeenNthCalledWith(1, encodedArray, true, false);
						expect(ws.send).toHaveBeenNthCalledWith(2, encodedArray, true, true);
					});
				});
			});

			describe('when getDoc resolves with ydoc.store.clients.size > 0', () => {
				it('should call ws.end', async () => {
					const { ws, subscriber, client, redisMessageSubscriber, openWsCallback, initDocCallback } = setup();
					const ydoc = createMock<Y.Doc>({ store: { clients: { size: 1 } } });
					const awareness = createMock<Awareness>();
					client.getDoc.mockResolvedValue({
						ydoc,
						awareness,
						redisLastId: '0',
						storeReferences: [],
						docChanged: true,
					});

					await openCallback(ws, subscriber, client, redisMessageSubscriber, openWsCallback, initDocCallback);

					expect(initDocCallback).not.toHaveBeenCalled();
				});
			});
		});

		describe('when user is closed', () => {
			const setup = () => {
				const { ws, subscriber, client, redisMessageSubscriber } = buildParams();

				const user = createMock<User>({ error: null, room: 'room', isClosed: true });
				ws.getUserData.mockReturnValue(user);

				return { ws, subscriber, client, redisMessageSubscriber };
			};

			it('should not call ws.cork', async () => {
				const { ws, subscriber, client, redisMessageSubscriber } = setup();

				await openCallback(ws, subscriber, client, redisMessageSubscriber);

				expect(ws.cork).not.toHaveBeenCalled();
			});
		});
	});
});
