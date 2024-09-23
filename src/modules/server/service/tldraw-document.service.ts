import { Inject, Injectable } from '@nestjs/common';
import { TemplatedApp } from 'uws';
import { RedisService } from '../../../infra/redis/index.js';
const UWS = 'UWS';

@Injectable()
export class TldrawDocumentService {
	public constructor(
		@Inject(UWS) private webSocketServer: TemplatedApp,
		private readonly redisService: RedisService,
	) {}

	public async deleteByDocName(parentId: string): Promise<void> {
		const docName = `y:room:${parentId}:index`;

		this.webSocketServer.publish(docName, 'action:delete');

		await this.redisService.addDeleteDocument(docName);
	}
}
