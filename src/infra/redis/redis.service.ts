import { Injectable } from '@nestjs/common';
import * as dns from 'dns';
import { Redis } from 'ioredis';
import * as util from 'util';
import { Logger } from '../logger/index.js';
import { IoRedisAdapter } from './ioredis.adapter.js';
import { RedisAdapter } from './redis.adapter.js';
import { RedisConfig } from './redis.config.js';

@Injectable()
export class RedisService {
	public constructor(
		private readonly config: RedisConfig,
		private readonly logger: Logger,
	) {
		this.logger.setContext(RedisService.name);
	}

	public async createRedisInstance(): Promise<RedisAdapter> {
		let redisInstance: Redis;
		if (this.config.REDIS_CLUSTER_ENABLED) {
			redisInstance = await this.createRedisSentinelInstance();
		} else {
			redisInstance = this.createNewRedisInstance();
		}
		const redisAdapter = new IoRedisAdapter(redisInstance, this.config, this.logger);

		return redisAdapter;
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
			this.logger.log('Error during service discovery:', err);
			throw err;
		}
	}
}
