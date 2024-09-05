import { Injectable, Inject } from '@nestjs/common';
import { RedisService } from '../../../infra/redis/index.js';
import { StorageService } from '../../../infra/storage/index.js';
import { TemplatedApp } from 'uws';
import { UWS } from '../api/websocket.gateway.js';

@Injectable()
export class TldrawDocumentService {
	constructor(
		private readonly storage: StorageService,
		@Inject(UWS) private webSocketServer: TemplatedApp,
		private readonly redisService: RedisService,
	) {}

	async deleteByDocName(parentId: string) {
		const docName = `y:room:${parentId}:index`;

		this.webSocketServer.publish(docName, 'deleted');

		await this.redisService.deleteDocument(docName);

		this.storage.deleteDocument(parentId);
	}
}
