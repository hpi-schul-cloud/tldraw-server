import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Test } from '@nestjs/testing';
import { TemplatedApp } from 'uws';
import { RedisService } from '../../../infra/redis/index.js';
import { TldrawDocumentService } from './tldraw-document.service.js';

describe('Tldraw-Document Service', () => {
	let service: TldrawDocumentService;
	let webSocketServer: TemplatedApp;
	let redisService: DeepMocked<RedisService>;

	beforeAll(async () => {
		const moduleFixture = await Test.createTestingModule({
			providers: [
				TldrawDocumentService,
				{
					provide: RedisService,
					useValue: createMock<RedisService>(),
				},
				{ provide: 'UWS', useValue: createMock<TemplatedApp>() },
			],
		}).compile();

		service = moduleFixture.get(TldrawDocumentService);
		webSocketServer = moduleFixture.get('UWS');
		redisService = moduleFixture.get(RedisService);
	});

	describe('when redis and storage service returns successfully', () => {
		const setup = () => {
			const parentId = '123';
			const docName = `y:room:${parentId}:index`;
			const expectedMessage = 'action:delete';

			return { parentId, docName, expectedMessage };
		};

		it('should call publish', async () => {
			const { parentId, docName, expectedMessage } = setup();

			await service.deleteByDocName(parentId);

			expect(webSocketServer.publish).toHaveBeenCalledWith(docName, expectedMessage);
		});

		it('should call addDeleteDocument', async () => {
			const { parentId, docName } = setup();

			await service.deleteByDocName(parentId);

			expect(redisService.addDeleteDocument).toHaveBeenCalledWith(docName);
		});
	});
});
