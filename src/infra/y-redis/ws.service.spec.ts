import { createMock } from '@golevelup/ts-jest';
import { encoding } from 'lib0';
import * as uws from 'uWebSockets.js';
import { Awareness } from 'y-protocols/awareness.js';
import * as Y from 'yjs';
import { YRedisClient } from './y-redis.client.js';
import { computeRedisRoomStreamName } from './helper.js';
import * as protocol from './protocol.js';
import { Subscriber } from './subscriber.service.js';
import { closeCallback, messageCallback, openCallback, upgradeCallback, YRedisUser } from './ws.service.js';

describe('ws service', () => {
	beforeEach(() => {
		jest.resetAllMocks();
	});

	const buildUpdate = (props: {
		messageType: number;
		length: number;
		numberOfUpdates: number;
		awarenessId: number;
		lastClock: number;
	}): Buffer => {
		const { messageType, length, numberOfUpdates, awarenessId, lastClock } = props;
		const encoder = encoding.createEncoder();
		encoding.writeVarUint(encoder, messageType); //
		encoding.writeVarUint(encoder, length); // Length of update
		encoding.writeVarUint(encoder, numberOfUpdates); // Number of awareness updates
		encoding.writeVarUint(encoder, awarenessId); // Awareness id
		encoding.writeVarUint(encoder, lastClock); // Lasclocl

		return Buffer.from(encoding.toUint8Array(encoder));
	};

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
			describe('when connection is not aborted', () => {
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

			describe('when connection is aborted', () => {
				it('should not upgrade the connection', async () => {
					const res = createMock<uws.HttpResponse>();
					const req = createMock<uws.HttpRequest>();
					const context = createMock<uws.us_socket_context_t>();
					const checkAuth = jest.fn().mockImplementationOnce(async () => {
						res.onAborted.mock.calls[0][0]();

						return await Promise.resolve({ hasWriteAccess: true, room: 'room', userid: 'userid' });
					});

					await upgradeCallback(res, req, context, checkAuth);

					expect(res.cork).not.toHaveBeenCalled();
				});
			});
		});
	});

	describe('openCallback', () => {
		const buildParams = () => {
			const ws = createMock<uws.WebSocket<YRedisUser>>();
			const subscriber = createMock<Subscriber>();
			const client = createMock<YRedisClient>({ redisPrefix: 'prefix' });
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
				const user = createMock<YRedisUser>({ error: { code, reason } });
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

				const user = createMock<YRedisUser>({ room: null, error: null });
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

				const user = createMock<YRedisUser>({ userid: null, error: null });
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

				const user = createMock<YRedisUser>({ error: null, room: 'room', isClosed: false });
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

				describe('when lastId is smaller than initial redis id', () => {
					it('should call subscriber.ensureSubId', async () => {
						const { ws, subscriber, client, user, redisMessageSubscriber } = setup();
						const ydoc = createMock<Y.Doc>({ store: { clients: { size: 0 } } });
						const awareness = createMock<Awareness>();
						client.getDoc.mockResolvedValueOnce({
							ydoc,
							awareness,
							redisLastId: '0-1',
							storeReferences: [],
							docChanged: true,
						});
						subscriber.subscribe.mockReturnValueOnce({ redisId: '1-2' });
						const redisStream = computeRedisRoomStreamName(user.room ?? '', 'index', client.redisPrefix);

						await openCallback(ws, subscriber, client, redisMessageSubscriber);

						expect(subscriber.ensureSubId).toHaveBeenCalledWith(redisStream, '0-1');
					});
				});

				describe('when lastId is bigger than initial redis id', () => {
					it('should call subscriber.ensureSubId', async () => {
						const { ws, subscriber, client, redisMessageSubscriber } = setup();
						const ydoc = createMock<Y.Doc>({ store: { clients: { size: 0 } } });
						const awareness = createMock<Awareness>();
						client.getDoc.mockResolvedValueOnce({
							ydoc,
							awareness,
							redisLastId: '2-1',
							storeReferences: [],
							docChanged: true,
						});
						subscriber.subscribe.mockReturnValueOnce({ redisId: '1-2' });

						await openCallback(ws, subscriber, client, redisMessageSubscriber);

						expect(subscriber.ensureSubId).not.toHaveBeenCalled();
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

				const user = createMock<YRedisUser>({ error: null, room: 'room', isClosed: true });
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

	describe('messageCallback', () => {
		const buildParams = () => {
			const ws = createMock<uws.WebSocket<YRedisUser>>();
			const client = createMock<YRedisClient>({ redisPrefix: 'prefix' });

			return { ws, client };
		};

		describe('when user has write access', () => {
			describe('when user has room', () => {
				describe('when error is thrown', () => {
					const setup = () => {
						const { ws, client } = buildParams();

						ws.getUserData.mockImplementationOnce(() => {
							throw new Error('error');
						});
						const messageBuffer = buildUpdate({
							messageType: protocol.messageAwareness,
							length: 0,
							numberOfUpdates: 1,
							awarenessId: 75,
							lastClock: 76,
						});

						return { ws, client, messageBuffer };
					};

					it('should not pass the error and call ws.end', () => {
						const { ws, client, messageBuffer } = setup();

						messageCallback(ws, messageBuffer, client);

						expect(ws.end).toHaveBeenCalledWith(1011);
					});
				});

				describe('when message is awareness update and users awarenessid is null', () => {
					const setup = () => {
						const { ws, client } = buildParams();
						const user = createMock<YRedisUser>({
							hasWriteAccess: true,
							room: 'room',
							awarenessId: null,
							awarenessLastClock: 99,
						});
						ws.getUserData.mockReturnValueOnce(user);
						const messageBuffer = buildUpdate({
							messageType: protocol.messageAwareness,
							length: 0,
							numberOfUpdates: 1,
							awarenessId: 75,
							lastClock: 76,
						});

						return { ws, client, messageBuffer, user };
					};

					it('should update users awarenessId and awarenessLastClock', () => {
						const { ws, client, messageBuffer, user } = setup();

						messageCallback(ws, messageBuffer, client);

						expect(user.awarenessId).toBe(75);
						expect(user.awarenessLastClock).toBe(76);
					});

					it('should call addMessage', () => {
						const { ws, client, messageBuffer, user } = setup();

						messageCallback(ws, messageBuffer, client);

						expect(client.addMessage).toHaveBeenCalledWith(user.room, 'index', messageBuffer);
					});
				});

				describe('when message is awareness update and users awarenessid is messages awarenessid', () => {
					const setup = () => {
						const { ws, client } = buildParams();
						const user = createMock<YRedisUser>({
							hasWriteAccess: true,
							room: 'room',
							awarenessId: 75,
							awarenessLastClock: 99,
						});
						ws.getUserData.mockReturnValueOnce(user);
						const messageBuffer = buildUpdate({
							messageType: protocol.messageAwareness,
							length: 0,
							numberOfUpdates: 1,
							awarenessId: 75,
							lastClock: 76,
						});

						return { ws, client, messageBuffer, user };
					};

					it('should update users awarenessId and awarenessLastClock', () => {
						const { ws, client, messageBuffer, user } = setup();

						messageCallback(ws, messageBuffer, client);

						expect(user.awarenessId).toBe(75);
						expect(user.awarenessLastClock).toBe(76);
					});

					it('should call addMessage', () => {
						const { ws, client, messageBuffer, user } = setup();

						messageCallback(ws, messageBuffer, client);

						expect(client.addMessage).toHaveBeenCalledWith(user.room, 'index', messageBuffer);
					});
				});

				describe('when message is sync update', () => {
					const setup = () => {
						const { ws, client } = buildParams();
						const user = createMock<YRedisUser>({
							hasWriteAccess: true,
							room: 'room',
							awarenessId: null,
							awarenessLastClock: 99,
						});
						ws.getUserData.mockReturnValueOnce(user);
						const messageBuffer = buildUpdate({
							messageType: protocol.messageSync,
							length: protocol.messageSyncUpdate,
							numberOfUpdates: 1,
							awarenessId: 75,
							lastClock: 76,
						});

						return { ws, client, messageBuffer, user };
					};

					it('should not update users awarenessId and awarenessLastClock', () => {
						const { ws, client, messageBuffer, user } = setup();

						messageCallback(ws, messageBuffer, client);

						expect(user.awarenessId).toBe(null);
						expect(user.awarenessLastClock).toBe(99);
					});

					it('should call addMessage', () => {
						const { ws, client, messageBuffer, user } = setup();

						messageCallback(ws, messageBuffer, client);

						expect(client.addMessage).toHaveBeenCalledWith(user.room, 'index', messageBuffer);
					});
				});

				describe('when message is sync step 2 update', () => {
					const setup = () => {
						const { ws, client } = buildParams();
						const user = createMock<YRedisUser>({
							hasWriteAccess: true,
							room: 'room',
							awarenessId: null,
							awarenessLastClock: 99,
						});
						ws.getUserData.mockReturnValueOnce(user);
						const messageBuffer = buildUpdate({
							messageType: protocol.messageSync,
							length: protocol.messageSyncStep2,
							numberOfUpdates: 1,
							awarenessId: 75,
							lastClock: 76,
						});

						return { ws, client, messageBuffer, user };
					};

					it('should not update users awarenessId and awarenessLastClock', () => {
						const { ws, client, messageBuffer, user } = setup();

						messageCallback(ws, messageBuffer, client);

						expect(user.awarenessId).toBe(null);
						expect(user.awarenessLastClock).toBe(99);
					});

					it('should call addMessage', () => {
						const { ws, client, messageBuffer, user } = setup();

						messageCallback(ws, messageBuffer, client);

						expect(client.addMessage).toHaveBeenCalledWith(user.room, 'index', messageBuffer);
					});
				});

				describe('when message is sync step 1 update', () => {
					const setup = () => {
						const { ws, client } = buildParams();
						const user = createMock<YRedisUser>({
							hasWriteAccess: true,
							room: 'room',
							awarenessId: null,
							awarenessLastClock: 99,
						});
						ws.getUserData.mockReturnValueOnce(user);
						const messageBuffer = buildUpdate({
							messageType: protocol.messageSync,
							length: protocol.messageSyncStep1,
							numberOfUpdates: 1,
							awarenessId: 75,
							lastClock: 76,
						});

						return { ws, client, messageBuffer, user };
					};

					it('should not update users awarenessId and awarenessLastClock', () => {
						const { ws, client, messageBuffer, user } = setup();

						messageCallback(ws, messageBuffer, client);

						expect(user.awarenessId).toBe(null);
						expect(user.awarenessLastClock).toBe(99);
					});

					it('should not call addMessage', () => {
						const { ws, client, messageBuffer, user } = setup();

						messageCallback(ws, messageBuffer, client);

						expect(client.addMessage).not.toHaveBeenCalledWith(user.room, 'index', messageBuffer);
					});
				});

				describe('when message is of unknown type', () => {
					const setup = () => {
						const { ws, client } = buildParams();
						const user = createMock<YRedisUser>({
							hasWriteAccess: true,
							room: 'room',
							awarenessId: null,
							awarenessLastClock: 99,
						});
						ws.getUserData.mockReturnValueOnce(user);
						const messageBuffer = buildUpdate({
							messageType: 999,
							length: 999,
							numberOfUpdates: 1,
							awarenessId: 75,
							lastClock: 76,
						});

						return { ws, client, messageBuffer, user };
					};

					it('should not update users awarenessId and awarenessLastClock', () => {
						const { ws, client, messageBuffer, user } = setup();

						messageCallback(ws, messageBuffer, client);

						expect(user.awarenessId).toBe(null);
						expect(user.awarenessLastClock).toBe(99);
					});

					it('should not call addMessage', () => {
						const { ws, client, messageBuffer, user } = setup();

						messageCallback(ws, messageBuffer, client);

						expect(client.addMessage).not.toHaveBeenCalledWith(user.room, 'index', messageBuffer);
					});
				});
			});

			describe('when user has no room', () => {
				describe('when message is awareness update', () => {
					const setup = () => {
						const { ws, client } = buildParams();
						const user = createMock<YRedisUser>({
							hasWriteAccess: true,
							room: null,
							awarenessId: null,
							awarenessLastClock: 99,
						});
						ws.getUserData.mockReturnValueOnce(user);
						const messageBuffer = buildUpdate({
							messageType: protocol.messageAwareness,
							length: 0,
							numberOfUpdates: 1,
							awarenessId: 75,
							lastClock: 76,
						});

						return { ws, client, messageBuffer, user };
					};

					it('should not update users awarenessId and awarenessLastClock', () => {
						const { ws, client, messageBuffer, user } = setup();

						messageCallback(ws, messageBuffer, client);

						expect(user.awarenessId).toBe(null);
						expect(user.awarenessLastClock).toBe(99);
					});

					it('should not call addMessage', () => {
						const { ws, client, messageBuffer, user } = setup();

						messageCallback(ws, messageBuffer, client);

						expect(client.addMessage).not.toHaveBeenCalledWith(user.room, 'index', messageBuffer);
					});
				});
			});
		});

		describe('when user has no write access', () => {
			describe('when user has room', () => {
				describe('when message is awareness update', () => {
					const setup = () => {
						const { ws, client } = buildParams();
						const user = createMock<YRedisUser>({
							hasWriteAccess: false,
							room: 'room',
							awarenessId: null,
							awarenessLastClock: 99,
						});
						ws.getUserData.mockReturnValueOnce(user);
						const messageBuffer = buildUpdate({
							messageType: protocol.messageAwareness,
							length: 0,
							numberOfUpdates: 1,
							awarenessId: 75,
							lastClock: 76,
						});

						return { ws, client, messageBuffer, user };
					};

					it('should not update users awarenessId and awarenessLastClock', () => {
						const { ws, client, messageBuffer, user } = setup();

						messageCallback(ws, messageBuffer, client);

						expect(user.awarenessId).toBe(null);
						expect(user.awarenessLastClock).toBe(99);
					});

					it('should not call addMessage', () => {
						const { ws, client, messageBuffer, user } = setup();

						messageCallback(ws, messageBuffer, client);

						expect(client.addMessage).not.toHaveBeenCalledWith(user.room, 'index', messageBuffer);
					});
				});
			});
		});
	});

	describe('closeCallback', () => {
		const buildParams = () => {
			const ws = createMock<uws.WebSocket<YRedisUser>>();
			const client = createMock<YRedisClient>({ redisPrefix: 'prefix' });
			const app = createMock<uws.TemplatedApp>();
			const subscriber = createMock<Subscriber>();

			return { ws, client, app, subscriber };
		};

		describe('when user has room', () => {
			describe('when user has awarenessId', () => {
				describe('when error is thrown', () => {
					const setup = () => {
						const { ws, client, app, subscriber } = buildParams();

						ws.getUserData.mockImplementationOnce(() => {
							throw new Error('error');
						});
						const code = 0;
						const message = buildUpdate({
							messageType: protocol.messageAwareness,
							length: 0,
							numberOfUpdates: 1,
							awarenessId: 75,
							lastClock: 76,
						});
						const redisMessageSubscriber = jest.fn();

						return { ws, client, app, code, subscriber, message, redisMessageSubscriber };
					};

					it('should not pass error', () => {
						const { app, ws, client, subscriber, code, message, redisMessageSubscriber } = setup();

						closeCallback(app, ws, client, subscriber, code, message, redisMessageSubscriber);
					});
				});

				describe('when app has 0 subscribers', () => {
					const setup = () => {
						const { ws, client, app, subscriber } = buildParams();
						app.numSubscribers.mockReturnValue(0);

						const user = createMock<YRedisUser>({
							room: 'room',
							awarenessId: 22,
							awarenessLastClock: 1,
							subs: new Set(['topic1', 'topic2']),
						});
						ws.getUserData.mockReturnValueOnce(user);
						const code = 0;
						const message = buildUpdate({
							messageType: protocol.messageAwareness,
							length: 0,
							numberOfUpdates: 1,
							awarenessId: 75,
							lastClock: 76,
						});
						const redisMessageSubscriber = jest.fn();
						const closeWsCallback = jest.fn();

						return { ws, client, app, code, subscriber, message, redisMessageSubscriber, user, closeWsCallback };
					};

					it('should call addMessage', () => {
						const { app, ws, client, subscriber, code, message, redisMessageSubscriber, user } = setup();

						closeCallback(app, ws, client, subscriber, code, message, redisMessageSubscriber);

						expect(client.addMessage).toHaveBeenCalledWith(
							user.room,
							'index',
							// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
							Buffer.from(protocol.encodeAwarenessUserDisconnected(user.awarenessId!, user.awarenessLastClock)),
						);
					});

					it('should set users isClosed to true', () => {
						const { app, ws, client, subscriber, code, message, redisMessageSubscriber, user } = setup();

						closeCallback(app, ws, client, subscriber, code, message, redisMessageSubscriber);

						expect(user.isClosed).toBe(true);
					});

					it('should call closeWsCallback', () => {
						const { app, ws, client, subscriber, code, message, redisMessageSubscriber, closeWsCallback } = setup();

						closeCallback(app, ws, client, subscriber, code, message, redisMessageSubscriber, closeWsCallback);

						expect(closeWsCallback).toHaveBeenCalledWith(ws, code, message);
					});

					it('should call subscriber.unsubscribe for every topic of user', () => {
						const { app, ws, client, subscriber, code, message, redisMessageSubscriber } = setup();

						closeCallback(app, ws, client, subscriber, code, message, redisMessageSubscriber);

						expect(subscriber.unsubscribe).toHaveBeenNthCalledWith(1, 'topic1', redisMessageSubscriber);
						expect(subscriber.unsubscribe).toHaveBeenNthCalledWith(2, 'topic2', redisMessageSubscriber);
					});
				});

				describe('when app has 1 subscriber', () => {
					const setup = () => {
						const { ws, client, app, subscriber } = buildParams();
						app.numSubscribers.mockReturnValue(1);
						const user = createMock<YRedisUser>({
							room: 'room',
							awarenessId: 22,
							awarenessLastClock: 1,
							subs: new Set(['topic1', 'topic2']),
						});
						ws.getUserData.mockReturnValueOnce(user);
						const code = 0;
						const message = buildUpdate({
							messageType: protocol.messageAwareness,
							length: 0,
							numberOfUpdates: 1,
							awarenessId: 75,
							lastClock: 76,
						});
						const redisMessageSubscriber = jest.fn();

						return { ws, client, app, code, subscriber, message, redisMessageSubscriber };
					};

					it('should not call addMessage', () => {
						const { app, ws, client, subscriber, code, message, redisMessageSubscriber } = setup();

						closeCallback(app, ws, client, subscriber, code, message, redisMessageSubscriber);

						expect(subscriber.unsubscribe).not.toHaveBeenCalled();
					});
				});
			});

			describe('when user has no awarenessId', () => {
				describe('when app has 0 subscribers', () => {
					const setup = () => {
						const { ws, client, app, subscriber } = buildParams();
						app.numSubscribers.mockReturnValueOnce(0);
						const user = createMock<YRedisUser>({
							room: 'room',
							awarenessId: null,
							awarenessLastClock: 1,
							subs: new Set(['topic1', 'topic2']),
						});
						ws.getUserData.mockReturnValueOnce(user);
						const code = 0;
						const message = buildUpdate({
							messageType: protocol.messageAwareness,
							length: 0,
							numberOfUpdates: 1,
							awarenessId: 75,
							lastClock: 76,
						});
						const redisMessageSubscriber = jest.fn();

						return { ws, client, app, code, subscriber, message, redisMessageSubscriber };
					};

					it('should not call addMessage', () => {
						const { app, ws, client, subscriber, code, message, redisMessageSubscriber } = setup();

						closeCallback(app, ws, client, subscriber, code, message, redisMessageSubscriber);

						expect(client.addMessage).not.toHaveBeenCalled();
					});
				});
			});
		});

		describe('when user has no room', () => {
			const setup = () => {
				const { ws, client, app, subscriber } = buildParams();
				app.numSubscribers.mockReturnValue(0);

				const user = createMock<YRedisUser>({
					room: null,
					awarenessId: 22,
					awarenessLastClock: 1,
					subs: new Set(['topic1', 'topic2']),
				});
				ws.getUserData.mockReturnValueOnce(user);
				const code = 0;
				const message = buildUpdate({
					messageType: protocol.messageAwareness,
					length: 0,
					numberOfUpdates: 1,
					awarenessId: 75,
					lastClock: 76,
				});
				const redisMessageSubscriber = jest.fn();
				const closeWsCallback = jest.fn();

				return { ws, client, app, code, subscriber, message, redisMessageSubscriber, user, closeWsCallback };
			};

			it('should not call addMessage', () => {
				const { app, ws, client, subscriber, code, message, redisMessageSubscriber } = setup();

				closeCallback(app, ws, client, subscriber, code, message, redisMessageSubscriber);

				expect(client.addMessage).not.toHaveBeenCalled();
			});

			it('should not call closeWsCallback', () => {
				const { app, ws, client, subscriber, code, message, redisMessageSubscriber, closeWsCallback } = setup();

				closeCallback(app, ws, client, subscriber, code, message, redisMessageSubscriber, closeWsCallback);

				expect(closeWsCallback).not.toHaveBeenCalled();
			});
		});
	});
});
