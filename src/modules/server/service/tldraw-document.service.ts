import { Injectable, Inject } from '@nestjs/common';
import { RedisService } from '../../../infra/redis/index.js';
import { StorageService } from '../../../infra/storage/index.js';
import { TemplatedApp, WebSocketBehavior } from 'uws';
// @ts-expect-error - @y/redis is only having jsdoc types
import { Api } from '@y/redis';
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

		await this.redisService.addDeleteDocument(docName);

		await this.storageService.deleteDocument(parentId);
	}
}
