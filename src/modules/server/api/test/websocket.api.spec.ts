import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as array from 'lib0/array';
import * as promise from 'lib0/promise';
import { WebSocket } from 'ws';
import { WebsocketProvider } from 'y-websocket';
import { Doc, encodeStateAsUpdateV2 } from 'yjs';
import { ResponsePayloadBuilder } from '../../../../infra//authorization/response.builder.js';
import { AuthorizationService } from '../../../../infra/authorization/index.js';
import { WebSocketCloseCode } from '../../../../shared/type/websocket-close-code.js';
import { ServerModule } from '../../server.module.js';
import { TldrawServerConfig } from '../../tldraw-server.config.js';

describe('Websocket Api Test', () => {
	let app: INestApplication;
	let authorizationService: DeepMocked<AuthorizationService>;
	let tldrawServerConfig: TldrawServerConfig;

	beforeAll(async () => {
		const moduleFixture = await Test.createTestingModule({
			imports: [ServerModule],
		})
			.overrideProvider(AuthorizationService)
			.useValue(createMock<AuthorizationService>())
			.compile();

		app = moduleFixture.createNestApplication();
		await app.init();
		authorizationService = await app.resolve(AuthorizationService);
		tldrawServerConfig = await app.resolve(TldrawServerConfig);
	});

	afterAll(async () => {
		await app.close();
	});

	const createWsClient = (room: string) => {
		const ydoc = new Doc();
		const serverUrl = tldrawServerConfig.TLDRAW_WEBSOCKET_URL;
		const prefix = 'y';
		const provider = new WebsocketProvider(serverUrl, prefix + '-' + room, ydoc, {
			// @ts-ignore
			WebSocketPolyfill: WebSocket,
			connect: true,
			disableBc: true,
		});

		return { ydoc, provider };
	};

	const waitUntilDocsEqual = (ydoc1: Doc, ydoc2: Doc): Promise<void> =>
		promise.until(0, () => {
			const e1 = encodeStateAsUpdateV2(ydoc1);
			const e2 = encodeStateAsUpdateV2(ydoc2);
			const isSynced = array.equalFlat(e1, e2);

			return isSynced;
		});

	describe('when clients have permission for room', () => {
		describe('when two clients connect to the same doc before any changes', () => {
			const setup = () => {
				const room = Math.random().toString(36).substring(7);

				authorizationService.hasPermission.mockResolvedValueOnce({
					hasWriteAccess: true,
					room,
					userid: 'userId1',
					error: null,
				});
				authorizationService.hasPermission.mockResolvedValueOnce({
					hasWriteAccess: true,
					room,
					userid: 'userId2',
					error: null,
				});

				const { ydoc: client1Doc, provider: provider1 } = createWsClient(room);
				const { ydoc: client2Doc, provider: provider2 } = createWsClient(room);

				return { client1Doc, client2Doc, provider1, provider2 };
			};

			it('syncs doc changes of first client to second client', async () => {
				const { client1Doc, client2Doc, provider1, provider2 } = setup();

				client1Doc.getMap().set('a', 1);

				await waitUntilDocsEqual(client1Doc, client2Doc);

				const result = client2Doc.getMap().get('a');
				expect(result).toBe(1);

				provider1.awareness.destroy();
				provider2.awareness.destroy();
				provider1.destroy();
				provider2.destroy();
			});

			it('syncs subsequent doc changes of second client to first client', async () => {
				const { client1Doc, client2Doc, provider1, provider2 } = setup();

				client1Doc.getMap().set('a', 1);
				await waitUntilDocsEqual(client1Doc, client2Doc);

				client2Doc.getMap().set('a', 2);
				await waitUntilDocsEqual(client1Doc, client2Doc);

				const result = client1Doc.getMap().get('a');
				expect(result).toBe(2);

				provider1.awareness.destroy();
				provider2.awareness.destroy();
				provider1.destroy();
				provider2.destroy();
			});
		});

		describe('when two clients connect to the same doc one before and one after the changes', () => {
			const setup = () => {
				const randomString = Math.random().toString(36).substring(7);
				const room = randomString;

				authorizationService.hasPermission.mockResolvedValueOnce({
					hasWriteAccess: true,
					room: randomString,
					userid: 'userId1',
					error: null,
				});
				authorizationService.hasPermission.mockResolvedValueOnce({
					hasWriteAccess: true,
					room: randomString,
					userid: 'userId2',
					error: null,
				});

				const { ydoc: client1Doc, provider } = createWsClient(room);

				return { client1Doc, room, provider };
			};

			it('syncs doc changes of first client to second client', async () => {
				const { client1Doc, room, provider } = setup();

				client1Doc.getMap().set('a', 1);

				const { ydoc: client2Doc, provider: provider2 } = createWsClient(room);
				await waitUntilDocsEqual(client1Doc, client2Doc);

				const result = client2Doc.getMap().get('a');
				expect(result).toBe(1);

				provider.awareness.destroy();
				provider.destroy();
				provider2.awareness.destroy();
				provider2.destroy();
			});

			it('syncs subsequent doc changes of second client to first client', async () => {
				const { client1Doc, room, provider } = setup();

				client1Doc.getMap().set('a', 1);

				const { ydoc: client2Doc, provider: provider2 } = createWsClient(room);
				await waitUntilDocsEqual(client1Doc, client2Doc);

				client2Doc.getMap().set('a', 2);
				await waitUntilDocsEqual(client1Doc, client2Doc);

				const result = client1Doc.getMap().get('a');
				expect(result).toBe(2);

				provider.awareness.destroy();
				provider.destroy();
				provider2.awareness.destroy();
				provider2.destroy();
			});
		});
	});

	describe('when client has no permission for room', () => {
		describe('when client connects and updates', () => {
			const setup = () => {
				const randomString = Math.random().toString(36).substring(7);
				const room = randomString;

				const errorResponse = ResponsePayloadBuilder.buildWithError(WebSocketCloseCode.Unauthorized, 'Unauthorized');
				authorizationService.hasPermission.mockResolvedValueOnce(errorResponse);

				const { ydoc: client1Doc, provider } = createWsClient(room);

				return { client1Doc, provider };
			};

			it('returns unauthorized error', async () => {
				const { provider } = setup();

				let error: CloseEvent;
				if (provider.ws) {
					provider.ws.onclose = (event: Event) => {
						error = event as CloseEvent;
					};
				}

				await promise.until(0, () => {
					return error as unknown as boolean;
				});

				// @ts-ignore
				expect(error.reason).toBe('Unauthorized');
				// @ts-ignore
				expect(error.code).toBe(WebSocketCloseCode.Unauthorized);

				provider.awareness.destroy();
				provider.destroy();
			});
		});

		describe('when client connects and has not a room', () => {
			const setup = () => {
				const randomString = Math.random().toString(36).substring(7);
				const room = randomString;

				const response = ResponsePayloadBuilder.build(null, 'userId');
				authorizationService.hasPermission.mockResolvedValueOnce(response);

				const { ydoc: client1Doc, provider } = createWsClient(room);

				return { client1Doc, provider };
			};

			it('returns error', async () => {
				const { provider } = setup();

				let error: CloseEvent;
				if (provider.ws) {
					provider.ws.onclose = (event: Event) => {
						error = event as CloseEvent;
					};
				}

				await promise.until(0, () => {
					return error as unknown as boolean;
				});

				// @ts-ignore
				expect(error.reason).toBe('Missing room or userid');
				// @ts-ignore
				expect(error.code).toBe(WebSocketCloseCode.InternalError);

				provider.awareness.destroy();
				provider.destroy();
			});
		});
	});

	describe('when openCallback catch an error', () => {
		const setup = () => {
			const randomString = Math.random().toString(36).substring(7);
			const room = randomString;

			const { ydoc: client1Doc, provider } = createWsClient(room);

			return { client1Doc, provider };
		};

		it('returns internal server error', async () => {
			const { provider } = setup();

			let error: CloseEvent;
			if (provider.ws) {
				provider.ws.onclose = (event: Event) => {
					error = event as CloseEvent;
				};
			}

			await promise.until(0, () => {
				return error as unknown as boolean;
			});

			// @ts-ignore
			expect(error.reason).toBe('Internal Server Error');
			// @ts-ignore
			expect(error.code).toBe(WebSocketCloseCode.InternalError);
		});
	});
});
