import { Controller, Delete, HttpCode, Inject, Param, UseGuards } from '@nestjs/common';
import { TldrawDocumentDeleteParams } from './dto/index.js';
import { ApiKeyGuard } from '../../../infra/auth-guard/guard/index.js';
import { StorageService } from '../../../infra/storage/storage.service.js';
import { TemplatedApp } from 'uws';
import { UWS } from './websocket.gateway.js';
import { RedisService } from '../../../infra/redis/index.js';

@UseGuards(ApiKeyGuard)
@Controller('tldraw-document')
export class TldrawDocumentController {
	constructor(
		private readonly storage: StorageService,
		@Inject(UWS) private webSocketServer: TemplatedApp,
		private readonly redisService: RedisService,
	) {}

	@HttpCode(204)
	@Delete(':docName')
	async deleteByDocName(@Param() urlParams: TldrawDocumentDeleteParams) {
		const docName = `y:room:${urlParams.docName}:index`;

		// Tell the client that the doc is deleted
		this.webSocketServer.publish(docName, 'deleted');

		// Delete doc in redis
		const redis = await this.redisService.createRedisInstance();
		redis.del(docName);

		// Delete doc in s3
		const store = await this.storage.get();

		const objectsList = [];
		const stream = store.client.listObjectsV2('ydocs', urlParams.docName, true);

		for await (const obj of stream) {
			objectsList.push(obj.name);
		}

		await store.client.removeObjects('ydocs', objectsList);
	}
}
