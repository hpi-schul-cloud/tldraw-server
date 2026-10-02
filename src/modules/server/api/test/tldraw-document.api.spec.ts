import { ConfigService } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { TestApiClient } from '../../../../infra/testing/index.js';
import { ServerModule } from '../../server.module.js';

describe('Tldraw-Document Api Test', () => {
	let app: INestApplication;
	let seaweedFsContainer: StartedTestContainer;
	const baseRoute = 'tldraw-document';
	const xApiKey = 'randomString';

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
	});

	afterAll(async () => {
		await app?.close();
		await seaweedFsContainer?.stop();
	});

	describe('deleteByDocName', () => {
		describe('when apiKey is not valid', () => {
			const setup = () => {
				const parentId = '60f1b9b3b3b3b3b3b3b3b3b3';
				const useAsApiKey = true;
				const invalidApiKey = 'invalid';
				const testApiClient = new TestApiClient(app, baseRoute, invalidApiKey, useAsApiKey);

				return { testApiClient, parentId };
			};

			it('returns unauthorized ', async () => {
				const { testApiClient, parentId } = setup();

				await testApiClient.delete(parentId).expect(401);
			});
		});

		describe('when apiKey is valid', () => {
			const setup = () => {
				const useAsApiKey = true;
				const testApiClient = new TestApiClient(app, baseRoute, xApiKey, useAsApiKey);

				return { testApiClient };
			};

			describe('when parentId is not a mongoId', () => {
				it('returns bad request 400', async () => {
					const { testApiClient } = setup();

					await testApiClient.delete('/asas').expect(400);
				});
			});

			describe('when parentId is a mongoId', () => {
				it('returns no content 204', async () => {
					const { testApiClient } = setup();
					const parentId = '60f1b9b3b3b3b3b3b3b3b3b3';

					await testApiClient.delete(parentId).expect(204);
				});
			});
		});
	});
});
