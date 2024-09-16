import { Injectable, Inject } from '@nestjs/common';
import { RedisService } from '../../../infra/redis/index.js';
import { StorageService } from '../../../infra/storage/index.js';
import { TemplatedApp } from 'uws';
const UWS = 'UWS';

@Injectable()
export class TldrawDocumentService {
	constructor(
		private readonly storageService: StorageService,
		@Inject(UWS) private webSocketServer: TemplatedApp,
		private readonly redisService: RedisService,
	) {}

	async deleteByDocName(parentId: string) {
		const docName = `y:room:${parentId}:index`;

		this.webSocketServer.publish(docName, 'action:delete');

		await this.redisService.deleteDocument(docName);

		await this.storageService.deleteDocument(parentId);
	}
}
