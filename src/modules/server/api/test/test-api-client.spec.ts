import { Controller, Delete, Get, Headers, HttpStatus, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { XApiKeyConfig } from 'infra/auth-guard/x-api-key.config.js';
import { TestApiClient } from './test-api-client.js';

@Controller('')
class TestXApiKeyController {
	@Delete(':id')
	public delete(@Headers('X-API-KEY') authorization: string) {
		return Promise.resolve({ method: 'delete', authorization });
	}

	@Post()
	public post(@Headers('X-API-KEY') authorization: string) {
		return Promise.resolve({ method: 'post', authorization });
	}

	@Get(':id')
	public get(@Headers('X-API-KEY') authorization: string) {
		return Promise.resolve({ method: 'get', authorization });
	}
}

describe(TestApiClient.name, () => {
	describe('when test request instance exists - x-api-key auth', () => {
		let app: INestApplication;
		const baseRoute = '';

		beforeAll(async () => {
			const moduleFixture = await Test.createTestingModule({
				controllers: [TestXApiKeyController],
			}).compile();

			app = moduleFixture.createNestApplication();
			await app.init();
		});

		afterAll(async () => {
			await app.close();
		});

		const setup = () => {
			const id = '60f1b9b3b3b3b3b3b3b3b3b3';
			const useAsApiKey = true;
			const validApiKey: XApiKeyConfig['ADMIN_API__ALLOWED_API_KEYS'][0] = 'randomString';
			const testApiClient = new TestApiClient(app, baseRoute, validApiKey, useAsApiKey);

			return { testApiClient, id };
		};

		describe('get', () => {
			it('should resolve requests', async () => {
				const { testApiClient, id } = setup();

				const result = await testApiClient.get(id);

				expect(result.statusCode).toEqual(HttpStatus.OK);
				expect(result.body).toEqual(expect.objectContaining({ method: 'get' }));
			});
		});

		describe('post', () => {
			it('should resolve requests', async () => {
				const { testApiClient } = setup();

				const result = await testApiClient.post();

				expect(result.statusCode).toEqual(HttpStatus.CREATED);
				expect(result.body).toEqual(expect.objectContaining({ method: 'post' }));
			});
		});

		describe('delete', () => {
			it('should resolve requests', async () => {
				const { testApiClient, id } = setup();

				const result = await testApiClient.delete(id);

				expect(result.statusCode).toEqual(HttpStatus.OK);
				expect(result.body).toEqual(expect.objectContaining({ method: 'delete' }));
			});
		});
	});
});
