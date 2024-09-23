import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as dns from 'dns';
import { Redis } from 'ioredis';
import * as util from 'util';
import { Logger } from '../logging/logger.js';

@Injectable()
export class RedisService {
	private sentinelServiceName: string;
	private internalRedisInstance?: Redis;
	private redisDeletionKey: string;
	private redisDeletionActionKey: string;

	public constructor(
		private configService: ConfigService,
		private logger: Logger,
	) {
		this.sentinelServiceName = this.configService.get<string>('REDIS_SENTINEL_SERVICE_NAME') ?? '';
		const redisPrefix = this.configService.get<string>('REDIS_PREFIX') ?? 'y';

		this.redisDeletionKey = `${redisPrefix}:delete`;
		this.redisDeletionActionKey = `${redisPrefix}:delete:action`;

		this.logger.setContext(RedisService.name);
	}

	public async createRedisInstance(): Promise<Redis> {
		let redisInstance: Redis;
		if (this.sentinelServiceName) {
			redisInstance = await this.createRedisSentinelInstance();
		} else {
			redisInstance = this.createNewRedisInstance();
		}

		return redisInstance;
	}

	public async addDeleteDocument(docName: string): Promise<void> {
		const redisInstance = await this.getInternalRedisInstance();

		await redisInstance.xadd(this.redisDeletionKey, '*', 'docName', docName);
		await redisInstance.publish(this.redisDeletionActionKey, docName);
	}

	public async subscribeToDeleteChannel(callback: (message: string) => void): Promise<void> {
		const redisSubscriberInstance = await this.createRedisInstance();
		redisSubscriberInstance.subscribe(this.redisDeletionActionKey);
		redisSubscriberInstance.on('message', (chan, message) => {
			callback(message);
		});
	}

	private async getInternalRedisInstance(): Promise<Redis> {
		if (!this.internalRedisInstance) {
			this.internalRedisInstance = await this.createRedisInstance();
		}

		return this.internalRedisInstance;
	}

	private createNewRedisInstance(): Redis {
		const redisUrl = this.configService.getOrThrow('REDIS');
		const redisInstance = new Redis(redisUrl);

		return redisInstance;
	}

	private async createRedisSentinelInstance(): Promise<Redis> {
		const sentinelName = this.configService.get<string>('REDIS_SENTINEL_NAME') ?? 'mymaster';
		const sentinelPassword = this.configService.getOrThrow('REDIS_SENTINEL_PASSWORD');
		const sentinels = await this.discoverSentinelHosts();
		this.logger.log('Discovered sentinels:', sentinels);

		const redisInstance = new Redis({
			sentinels,
			sentinelPassword,
			password: sentinelPassword,
			name: sentinelName,
		});

		return redisInstance;
	}

	private async discoverSentinelHosts(): Promise<{ host: string; port: number }[]> {
		const resolveSrv = util.promisify(dns.resolveSrv);
		try {
			const records = await resolveSrv(this.sentinelServiceName);

			const hosts = records.map((record) => ({
				host: record.name,
				port: record.port,
			}));

			return hosts;
		} catch (err) {
			this.logger.error('Error during service discovery:', err);
			throw err;
		}
	}
}
