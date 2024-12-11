import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as array from 'lib0/array';
import * as promise from 'lib0/promise';
import { WebSocket } from 'ws';
import { WebsocketProvider } from 'y-websocket';
import { Doc, encodeStateAsUpdateV2 } from 'yjs';
import { ResponsePayloadBuilder } from '../../../../infra//authorization/response.builder.js';
import { AuthorizationService } from '../../../../infra/authorization/authorization.service.js';
import { ServerModule } from '../../server.module.js';

/**
 * You must start minio locally and set in .env.test the values:
 * S3_ACCESS_KEY=
 * S3_SECRET_KEY=
 */
describe('Websocket Api Test', () => {
	let app: INestApplication;
	let authorizationService: DeepMocked<AuthorizationService>;

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
	});

	afterAll(async () => {
		await app.close();
	});

	const createWsClient = (room: string) => {
		const ydoc = new Doc();
		const serverUrl = 'ws://localhost:3345';
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

	/* 	const waitUntilDocValueMatches = (ydoc: Doc, key: string, value: number): Promise<void> =>
		promise.until(0, () => {
			const result = ydoc.getMap().get(key);
			const isMatch = result === value;

			return isMatch;
		}); */

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

				const { ydoc: client1Doc } = createWsClient(room);
				const { ydoc: client2Doc } = createWsClient(room);

				return { client1Doc, client2Doc };
			};

			it('syncs doc changes of first client to second client', async () => {
				const { client1Doc, client2Doc } = setup();

				client1Doc.getMap().set('a', 1);

				await waitUntilDocsEqual(client1Doc, client2Doc);

				const result = client2Doc.getMap().get('a');
				expect(result).toBe(1);
			});

			it('syncs subsequent doc changes of second client to first client', async () => {
				const { client1Doc, client2Doc } = setup();

				client1Doc.getMap().set('a', 1);
				await waitUntilDocsEqual(client1Doc, client2Doc);

				client2Doc.getMap().set('a', 2);
				await waitUntilDocsEqual(client1Doc, client2Doc);

				const result = client1Doc.getMap().get('a');
				expect(result).toBe(2);
			});

			/* it('syncs nearly parallel doc changes of second client to first client', async () => {
				// This test is instable
				const { client1Doc, client2Doc } = setup();

				client1Doc.getMap().set('a', 1);
				client2Doc.getMap().set('a', 2);

				await waitUntilDocValueMatches(client1Doc, 'a', 2);

				const result = client1Doc.getMap().get('a');
				expect(result).toBe(2);
			}); */
		});

		describe('when two clients connect to the same doc one before and one after the changes', () => {
			const setup = () => {
				const randomString = Math.random().toString(36).substring(7);
				const room = randomString;

				authorizationService.hasPermission.mockResolvedValue({
					hasWriteAccess: true,
					room: randomString,
					userid: 'userId',
					error: null,
				});

				const { ydoc: client1Doc } = createWsClient(room);

				return { client1Doc, room };
			};

			it('syncs doc changes of first client to second client', async () => {
				const { client1Doc, room } = setup();

				client1Doc.getMap().set('a', 1);

				const { ydoc: client2Doc } = createWsClient(room);
				await waitUntilDocsEqual(client1Doc, client2Doc);

				const result = client2Doc.getMap().get('a');
				expect(result).toBe(1);
			});

			it('syncs subsequent doc changes of second client to first client', async () => {
				const { client1Doc, room } = setup();

				client1Doc.getMap().set('a', 1);

				const { ydoc: client2Doc } = createWsClient(room);
				await waitUntilDocsEqual(client1Doc, client2Doc);

				client2Doc.getMap().set('a', 2);
				await waitUntilDocsEqual(client1Doc, client2Doc);

				const result = client1Doc.getMap().get('a');
				expect(result).toBe(2);
			});

			/* 	it('syncs nearly parallel doc changes of second client to first client', async () => {
				// This test is instable
				const { client1Doc, room } = setup();

				client1Doc.getMap().set('a', 1);

				const { ydoc: client2Doc } = createWsClient(room);
				client2Doc.getMap().set('a', 2);

				await waitUntilDocValueMatches(client1Doc, 'a', 2);

				const result = client1Doc.getMap().get('a');
				expect(result).toBe(2);
			}); */
		});

		/* describe('when doc is only pesisted in storage and not in redis', () => {
			// Need to implement this test
		}); */
	});

	describe('when client has no permission for room', () => {
		describe('when client connects and updates', () => {
			const setup = () => {
				const randomString = Math.random().toString(36).substring(7);
				const room = randomString;

				const errorResponse = ResponsePayloadBuilder.buildWithError(4401, 'Unauthorized');
				authorizationService.hasPermission.mockResolvedValue(errorResponse);

				const { ydoc: client1Doc, provider } = createWsClient(room);

				return { client1Doc, provider };
			};

			it('syncs doc changes of first client to second client', async () => {
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
				expect(error.code).toBe(4401);
			});
		});
	});
});
