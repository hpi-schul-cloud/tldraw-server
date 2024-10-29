import { Injectable } from '@nestjs/common';
import * as dns from 'dns';
import { Redis } from 'ioredis';
import * as util from 'util';
import { LegacyLogger } from '../logger/index.js';
import { RedisConfig } from './redis.config.js';

@Injectable()
export class RedisService {
	private readonly redisDeletionKey: string;
	private readonly redisDeletionActionKey: string;
	private internalRedisInstance?: Redis;

	public constructor(
		private readonly config: RedisConfig,
		private readonly logger: LegacyLogger,
	) {
		const redisPrefix = this.config.REDIS_PREFIX;

		this.redisDeletionKey = `${redisPrefix}:delete`;
		this.redisDeletionActionKey = `${redisPrefix}:delete:action`;
		this.logger.setContext(RedisService.name);
	}

	public async createRedisInstance(): Promise<Redis> {
		let redisInstance: Redis;
		if (this.config.REDIS_CLUSTER_ENABLED) {
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
		const redisUrl = this.config.REDIS;
		const redisInstance = new Redis(redisUrl);

		return redisInstance;
	}

	private async createRedisSentinelInstance(): Promise<Redis> {
		const sentinelName = this.config.REDIS_SENTINEL_NAME;
		const sentinelPassword = this.config.REDIS_SENTINEL_PASSWORD;
		const sentinels = await this.discoverSentinelHosts();
		this.logger.log(`Discovered sentinels: ${JSON.stringify(sentinels)}`);

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
			const records = await resolveSrv(this.config.REDIS_SENTINEL_SERVICE_NAME);

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
