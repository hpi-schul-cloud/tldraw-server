import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Test } from '@nestjs/testing';
import { TemplatedApp } from 'uWebSockets.js';
import { RedisAdapter, RedisFactory } from '../../../infra/redis/index.js';
import { REDIS_FOR_DELETION, UWS } from '../server.const.js';
import { TldrawDocumentService } from './tldraw-document.service.js';

describe('Tldraw-Document Service', () => {
	let service: TldrawDocumentService;
	let webSocketServer: TemplatedApp;
	let redisAdapter: DeepMocked<RedisAdapter>;

	beforeAll(async () => {
		const moduleFixture = await Test.createTestingModule({
			providers: [
				TldrawDocumentService,
				{
					provide: RedisFactory,
					useValue: createMock<RedisFactory>(),
				},
				{ provide: UWS, useValue: createMock<TemplatedApp>() },
				{
					provide: REDIS_FOR_DELETION,
					useValue: createMock<RedisAdapter>({ redisPrefix: 'y' }),
				},
			],
		}).compile();

		service = moduleFixture.get(TldrawDocumentService);
		webSocketServer = moduleFixture.get(UWS);
		redisAdapter = moduleFixture.get(REDIS_FOR_DELETION);
	});

	describe('when redis and storage service returns successfully', () => {
		const setup = () => {
			const parentId = '123';
			const docName = `y:room:${parentId}:index`;
			const expectedMessage = 'action:delete';

			return { parentId, docName, expectedMessage };
		};

		it('should call webSocketServer.publish', async () => {
			const { parentId, docName, expectedMessage } = setup();

			await service.deleteByDocName(parentId);

			expect(webSocketServer.publish).toHaveBeenCalledWith(docName, expectedMessage);
		});

		it('should call redisAdapter.markToDeleteByDocName', async () => {
			const { parentId, docName } = setup();

			await service.deleteByDocName(parentId);

			expect(redisAdapter.markToDeleteByDocName).toHaveBeenCalledWith(docName);
		});
	});
});
