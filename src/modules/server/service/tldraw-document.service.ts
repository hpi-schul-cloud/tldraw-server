import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { TemplatedApp } from 'uws';
import { RedisService } from '../../../infra/redis/index.js';
import { RedisAdapter } from '../../../infra/redis/interfaces/index.js';
import { computeRedisRoomStreamName } from '../../../infra/y-redis/helper.js';
const UWS = 'UWS';

@Injectable()
export class TldrawDocumentService implements OnModuleInit {
	private redisInstance!: RedisAdapter;

	public constructor(
		@Inject(UWS) private readonly webSocketServer: TemplatedApp,
		private readonly redisService: RedisService,
	) {}

	public async onModuleInit(): Promise<void> {
		this.redisInstance = await this.redisService.createRedisInstance();
	}

	public async deleteByDocName(parentId: string): Promise<void> {
		const redisPrefix = this.redisInstance.redisPrefix;
		const docName = computeRedisRoomStreamName(parentId, 'index', redisPrefix);

		this.webSocketServer.publish(docName, 'action:delete');

		await this.redisInstance.markToDeleteByDocName(docName);
	}
}
