import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TldrawDocumentService } from './tldraw-document.service.js';
import { RedisService } from '../../../infra/redis/index.js';
import { StorageService } from '../../../infra/storage/index.js';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { TemplatedApp } from 'uws';

describe('Tldraw-Document Service', () => {
	let app: INestApplication;
	let service: TldrawDocumentService;
	let webSocketServer: TemplatedApp;
	let redisService: DeepMocked<RedisService>;
	let storageService: DeepMocked<StorageService>;

	beforeAll(async () => {
		const moduleFixture = await Test.createTestingModule({
			providers: [
				TldrawDocumentService,
				{
					provide: RedisService,
					useValue: createMock<RedisService>(),
				},
				{
					provide: StorageService,
					useValue: createMock<StorageService>(),
				},
				{ provide: 'UWS', useValue: createMock<TemplatedApp>() },
			],
		}).compile();

		service = moduleFixture.get(TldrawDocumentService);
		webSocketServer = moduleFixture.get('UWS');
		redisService = moduleFixture.get(RedisService);
		storageService = moduleFixture.get(StorageService);
	});

	describe('when redis and storage service returns successfully', () => {
		const setup = () => {
			const parentId = '123';
			const docName = `y:room:${parentId}:index`;
			const expectedMessage = 'deleted';

			return { parentId, docName, expectedMessage };
		};

		it('should call publish', async () => {
			const { parentId, docName, expectedMessage } = setup();

			await service.deleteByDocName(parentId);

			expect(webSocketServer.publish).toHaveBeenCalledWith(docName, expectedMessage);
		});

		it('should call storageService deleteDocument', async () => {
			const { parentId, docName, expectedMessage } = setup();

			await service.deleteByDocName(parentId);

			expect(storageService.deleteDocument).toHaveBeenCalledWith(parentId);
		});
	});

	describe('when storage service throws error', () => {
		const setup = () => {
			const error = new Error('error');
			const parentId = '123';

			storageService.deleteDocument.mockRejectedValueOnce(error);

			return { error, parentId };
		};

		it('should return error', () => {
			const { error, parentId } = setup();

			expect(service.deleteByDocName(parentId)).rejects.toThrow(error);
		});
	});
});
