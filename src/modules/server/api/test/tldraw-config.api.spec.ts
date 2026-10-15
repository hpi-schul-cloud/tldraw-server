import { INestApplication } from '@nestjs/common';
import { StartedTestContainer } from 'testcontainers';
import { TestApiClient, createTestAppWithContainers } from '../../../../infra/testing/index.js';
import { ServerModule } from '../../server.module.js';

describe('Tldraw-Config Api Test', () => {
	let app: INestApplication;
	let testApiClient: TestApiClient;
	let seaweedFsContainer: StartedTestContainer;

	beforeAll(async () => {
		({ app, seaweedFsContainer } = await createTestAppWithContainers([ServerModule]));
		testApiClient = new TestApiClient(app, 'tldraw/config');
	});

	afterAll(async () => {
		await app?.close();
		await seaweedFsContainer?.stop();
	});

	describe('publicConfig', () => {
		it('should return the public config', async () => {
			const response = await testApiClient.get('/public').expect(200);

			expect(response.body).toEqual({
				FEATURE_TLDRAW_ENABLED: true,
				TLDRAW_ASSETS_ALLOWED_MIME_TYPES_LIST: ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml'],
				TLDRAW_ASSETS_ENABLED: true,
				TLDRAW_ASSETS_MAX_SIZE_BYTES: 10485760,
				TLDRAW_WEBSOCKET_URL: 'ws://localhost:3399',
				NOT_AUTHENTICATED_REDIRECT_URL: 'http://localhost:4000/login',
			});
		});
	});
});
