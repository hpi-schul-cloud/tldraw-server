jest.mock('@y/redis');

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { StorageService } from '../../../../infra/storage/storage.service.js';
import { RedisService } from '../../../../infra/redis/redis.service.js';
import { App } from 'uws';
import { createMock } from '@golevelup/ts-jest';
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