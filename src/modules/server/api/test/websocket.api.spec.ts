import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as array from 'lib0/array';
import * as promise from 'lib0/promise';
import { WebSocket } from 'ws';
import { WebsocketProvider } from 'y-websocket';
import { Doc, encodeStateAsUpdateV2 } from 'yjs';
import { AuthorizationService } from '../../../../infra/authorization/authorization.service.js';
import { RedisAdapter } from '../../../../infra/redis/interfaces/redis-adapter.js';
import { RedisService } from '../../../../infra/redis/redis.service.js';
import { ServerModule } from '../../server.module.js';

describe('Websocket Api Test', () => {
	let app: INestApplication;
	let redisAdapter: RedisAdapter;
	let authorizationService: DeepMocked<AuthorizationService>;
	const prefix = 'y';

	beforeAll(async () => {
		const moduleFixture = await Test.createTestingModule({
			imports: [ServerModule],
		})
			.overrideProvider(AuthorizationService)
			.useValue(createMock<AuthorizationService>())
			.compile();

		app = moduleFixture.createNestApplication();
		await app.init();

		const redisService = await app.resolve(RedisService);
		redisAdapter = await redisService.createRedisInstance();

		authorizationService = await app.resolve(AuthorizationService);
	});

	afterAll(async () => {
		await app.close();
	});

	const createWsClient = (room: string) => {
		const ydoc = new Doc();
		const serverUrl = 'ws://localhost:3345';
		const provider = new WebsocketProvider(serverUrl, prefix + '-' + room, ydoc, {
			// @ts-ignore
			WebSocketPolyfill: WebSocket,
			connect: true,
			disableBc: true,
		});
		provider.connect();

		return { ydoc, provider };
	};

	const waitUntilDocsEqual = (ydoc1: Doc, ydoc2: Doc): Promise<void> => {
		console.info('waiting for docs to sync...');

		return promise.until(0, () => {
			const e1 = encodeStateAsUpdateV2(ydoc1);
			const e2 = encodeStateAsUpdateV2(ydoc2);
			const isSynced = array.equalFlat(e1, e2);
			isSynced && console.info('docs sycned!');

			return isSynced;
		});
	};

	describe('when two clients connect to the same doc', () => {
		const setup = () => {
			authorizationService.hasPermission.mockResolvedValue({
				hasWriteAccess: true,
				room: 'testRoom',
				userid: 'userId',
				error: null,
			});
		};

		it('syncs docs between clients', async () => {
			setup();
			const { ydoc: doc1 } = createWsClient('testRoom');
			doc1.getMap().set('a', 1);

			const { ydoc: doc2 } = createWsClient('testRoom');

			await waitUntilDocsEqual(doc1, doc2);

			const result = doc2.getMap().get('a');

			expect(result).toBe(1);
		});

		it('syncs docs between clients when seconde client overwrites first', async () => {
			const { ydoc: doc1 } = createWsClient('testRoom');
			doc1.getMap().set('a', 1);

			const { ydoc: doc2 } = createWsClient('testRoom');

			await waitUntilDocsEqual(doc1, doc2);

			doc2.getMap().set('a', 2);

			await waitUntilDocsEqual(doc1, doc2);

			const result = doc1.getMap().get('a');

			expect(result).toBe(2);
		});

		/* describe('when doc is only pesisted in storage and not in redis', () => {
			it('syncs docs between clients', async () => {
				const room = 'testRoom';
				const { ydoc: doc1 } = createWsClient(room);
				doc1.getMap().set('a', 1);

				const docStreamExists = await redisAdapter.exists(
					computeRedisRoomStreamName(room + '-' + 'map', 'index', prefix),
				);

				const { ydoc: doc2 } = createWsClient('testRoom');

				await waitUntilDocsEqual(doc1, doc2);

				const result = doc2.getMap().get('a');

				expect(result).toBe(1);
			});
		}); */
	});
});
