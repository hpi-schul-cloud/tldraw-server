jest.mock('../../../../infra/y-redis/api.service.js', () => {
	return {
		Api: jest.fn().mockImplementation(() => {
			return {
				prototype: jest.fn(),
			};
		}),
	};
});

import { createMock } from '@golevelup/ts-jest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { App } from 'uws';
import { RedisService } from '../../../../infra/redis/redis.service.js';
import { StorageService } from '../../../../infra/storage/storage.service.js';
import { ServerModule } from '../../server.module.js';
import { WebsocketGateway } from '../websocket.gateway.js';

describe('Tldraw-Document Api Test', () => {
	let app: INestApplication;

	beforeAll(async () => {
		const moduleFixture = await Test.createTestingModule({
			imports: [ServerModule],
		})
			.overrideProvider(StorageService)
			.useValue(createMock<StorageService>())
			.overrideProvider(RedisService)
			.useValue(createMock<RedisService>())
			.overrideProvider('UWS')
			.useValue(createMock<typeof App>())
			.overrideProvider(WebsocketGateway)
			.useValue(createMock<WebsocketGateway>())
			.compile();

		app = moduleFixture.createNestApplication();
		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	describe('deleteByDocName', () => {
		it('true to be true', () => {
			expect(true).toBe(true);
		});
	});
});
