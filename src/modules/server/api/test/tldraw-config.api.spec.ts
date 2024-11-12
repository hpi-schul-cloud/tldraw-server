import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ServerTestModule } from '../../server.test.module.js';
import { TestApiClient } from './test-api-client.js';

describe('Tldraw-Config Api Test', () => {
	let app: INestApplication;
	let testApiClient: TestApiClient;

	beforeAll(async () => {
		const moduleFixture = await Test.createTestingModule({
			imports: [ServerTestModule],
		}).compile();

		app = moduleFixture.createNestApplication();
		await app.init();

		testApiClient = new TestApiClient(app, 'tldraw/config');
	});

	afterAll(async () => {
		await app.close();
	});

	describe('publicConfig', () => {
		it('should return the public config', async () => {
			const response = await testApiClient.get('/public').expect(200);

			expect(response.body).toEqual({
				FEATURE_TLDRAW_ENABLED: true,
				TLDRAW__ASSETS_ALLOWED_MIME_TYPES_LIST: ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml'],
				TLDRAW__ASSETS_ENABLED: true,
				TLDRAW__ASSETS_MAX_SIZE_BYTES: 10485760,
				TLDRAW__WEBSOCKET_URL: 'ws://localhost:3345',
			});
		});
	});
});
