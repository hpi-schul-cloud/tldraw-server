import { INestApplication } from '@nestjs/common';
import { StartedTestContainer } from 'testcontainers';
import { TestApiClient, createTestAppWithContainers } from '../../../../infra/testing/index.js';
import { ServerModule } from '../../server.module.js';

describe('Tldraw-Document Api Test', () => {
	let app: INestApplication;
	let seaweedFsContainer: StartedTestContainer;
	const baseRoute = 'tldraw-document';
	const xApiKey = 'randomString';

	beforeAll(async () => {
		({ app, seaweedFsContainer } = await createTestAppWithContainers([ServerModule]));
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
