import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { WebSocket } from 'ws';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { Doc } from 'yjs';
import { AuthorizationService } from '../../infra/authorization/authorization.service.js';
import { IoRedisAdapter } from '../../infra/redis/ioredis.adapter.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import { computeRedisRoomStreamName } from '../../infra/y-redis/helper.js';
import { REDIS_FOR_DELETION } from '../../modules/server/server.const.js';
import { ServerModule } from '../../modules/server/server.module.js';
import { TldrawServerConfig } from '../../modules/server/tldraw-server.config.js';
import { WorkerModule } from './worker.module.js';
import { WorkerService } from './worker.service.js';

describe('Worker Api Test', () => {
	let app: INestApplication;
	let authorizationService: DeepMocked<AuthorizationService>;
	let tldrawServerConfig: TldrawServerConfig;
	let workerService: WorkerService;
	let storageService: StorageService;
	let ioRedisAdapter: IoRedisAdapter;

	beforeAll(async () => {
		const moduleFixture = await Test.createTestingModule({
			imports: [ServerModule, WorkerModule],
		})
			.overrideProvider(AuthorizationService)
			.useValue(createMock<AuthorizationService>())
			.compile();

		app = moduleFixture.createNestApplication();
		await app.init();
		authorizationService = await app.resolve(AuthorizationService);
		tldrawServerConfig = await app.resolve(TldrawServerConfig);
		workerService = await app.resolve(WorkerService);
		storageService = await app.resolve(StorageService);
		ioRedisAdapter = await app.resolve(REDIS_FOR_DELETION);
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

	describe('when one client sends update', () => {
		const setup = () => {
			workerService.start();

			const room = Math.random().toString(36).substring(7);

			authorizationService.hasPermission.mockResolvedValueOnce({
				hasWriteAccess: true,
				room,
				userid: 'userId1',
				error: null,
			});

			const { ydoc: client1Doc } = createWsClient(room);

			const property = 'property';
			const value = 'value';

			client1Doc.getMap().set(property, value);

			return { client1Doc, room, property, value };
		};

		it('saves doc to storage', async () => {
			const { room, property, value } = setup();

			let doc;
			while (!doc) {
				doc = await storageService.retrieveDoc(room, 'index');
			}

			let decodedDoc;
			if (doc?.doc) {
				decodedDoc = Y.decodeUpdateV2(doc.doc);
			}

			// @ts-ignore
			const resultProperty1 = decodedDoc.structs[0].parentSub;
			// @ts-ignore
			const resultUpdateValue = decodedDoc.structs[0].content.arr[0];

			expect(resultProperty1).toBe(property);
			expect(resultUpdateValue).toBe(value);

			workerService.stop();
		}, 10000);
	});

	describe('when second client sends update', () => {
		const setup = () => {
			workerService.start();

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

			const property1 = 'property1';
			const property2 = 'property2';
			const value1 = 'value1';
			const value2 = 'value2';

			client1Doc.getMap().set(property1, value1);
			client2Doc.getMap().set(property2, value2);

			return { client1Doc, room, property2, value2 };
		};

		it('saves doc to storage', async () => {
			const { room, property2, value2 } = setup();

			let resultProperty;
			let resultValue;
			while (!resultProperty) {
				const doc = await storageService.retrieveDoc(room, 'index');
				if (doc?.doc) {
					const decodedDoc = Y.decodeUpdateV2(doc.doc);
					console.log(decodedDoc);

					// @ts-ignore
					resultProperty = decodedDoc.structs.find((item) => item.parentSub === property2).parentSub;
					// @ts-ignore
					resultValue = decodedDoc.structs.find((item) => item.content.arr[0] === value2).content.arr[0];
				}
			}

			expect(resultProperty).toBe(property2);
			expect(resultValue).toBe(value2);

			workerService.stop();
		});
	});

	describe('when deleted doc entry exists', () => {
		const setup = async () => {
			workerService.start();

			const room = Math.random().toString(36).substring(7);

			authorizationService.hasPermission.mockResolvedValueOnce({
				hasWriteAccess: true,
				room,
				userid: 'userId1',
				error: null,
			});

			const { ydoc: client1Doc, provider } = createWsClient(room);

			const property = 'property';
			const value = 'value';

			client1Doc.getMap().set(property, value);

			let doc;
			while (!doc) {
				doc = await storageService.retrieveDoc(room, 'index');
			}

			provider.disconnect();

			const streamName = computeRedisRoomStreamName(room, 'index', 'y');
			await ioRedisAdapter.markToDeleteByDocName(streamName);

			return { room };
		};

		it('deletes doc in storage', async () => {
			const { room } = await setup();

			let doc = undefined;
			while (doc !== null) {
				try {
					doc = await storageService.retrieveDoc(room, 'index');
				} catch {}
			}

			expect(doc).toBeNull();

			workerService.stop();
		}, 10000);
	});
});
