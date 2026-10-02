import { ConfigService } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { TestApiClient } from '../../../../infra/testing/index.js';
import { ServerModule } from '../../server.module.js';

describe('Tldraw-Config Api Test', () => {
	let app: INestApplication;
	let testApiClient: TestApiClient;
	let seaweedFsContainer: StartedTestContainer;

	beforeAll(async () => {
		seaweedFsContainer = await new GenericContainer('chrislusf/seaweedfs:latest')
			.withCommand(['mini', '-dir=/data', '-bucket=ydocs'])
			.withExposedPorts(8333)
			.withWaitStrategy(Wait.forListeningPorts())
			.start();

		const moduleFixture = await Test.createTestingModule({
			imports: [ServerModule],
		})
			.overrideProvider(ConfigService)
			.useValue({
				get: (key: string) => {
					if (key === 'S3_ENDPOINT') {
						return seaweedFsContainer.getHost();
					}

					if (key === 'S3_PORT') {
						return seaweedFsContainer.getMappedPort(8333).toString();
					}

					return process.env[key];
				},
			})
			.compile();

		app = moduleFixture.createNestApplication();
		await app.init();

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
