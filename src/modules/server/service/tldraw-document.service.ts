import { Inject, Injectable } from '@nestjs/common';
import { TemplatedApp } from 'uWebSockets.js';
import { RedisAdapter } from '../../../infra/redis/index.js';
import { computeRedisRoomStreamName } from '../../../infra/y-redis/index.js';
import { REDIS_FOR_DELETION, UWS } from '../server.const.js';

@Injectable()
export class TldrawDocumentService {
	public constructor(
		@Inject(UWS) private readonly webSocketServer: TemplatedApp,
		@Inject(REDIS_FOR_DELETION) private readonly redisAdapter: RedisAdapter,
	) {}

	public async deleteByDocName(parentId: string): Promise<void> {
		const redisPrefix = this.redisAdapter.redisPrefix;
		const docName = computeRedisRoomStreamName(parentId, 'index', redisPrefix);

		this.webSocketServer.publish(docName, 'action:delete');

		await this.redisAdapter.markToDeleteByDocName(docName);
	}
}
