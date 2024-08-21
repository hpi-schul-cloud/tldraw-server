import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as dns from 'dns';
import { Redis } from 'ioredis';
import * as util from 'util';
import { Logger } from '../logging/logger.js';

@Injectable()
export class RedisService {
  private sentinelServiceName: string;

  constructor(private configService: ConfigService, private logger: Logger) {
    this.sentinelServiceName = this.configService.get<string>(
      'REDIS_SENTINEL_SERVICE_NAME') || '';

    this.logger.setContext(RedisService.name);
  }

  async getRedisInstance() {
    let redisInstance: Redis;
    if (this.sentinelServiceName) {
      redisInstance = await this.createRedisSentinelInstance();
    } else {
      redisInstance = this.createNewRedisInstance();
    }

    return redisInstance;
  }

  private createNewRedisInstance() {
    const redisUrl = this.configService.getOrThrow('REDIS');;
    const redisInstance = new Redis(redisUrl);

    return redisInstance;
  }

  private async createRedisSentinelInstance() {
    const sentinelName = this.configService.get<string>('REDIS_SENTINEL_NAME') || 'mymaster';
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

  private async discoverSentinelHosts() {
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
