import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as dns from 'dns';
import { Redis } from 'ioredis';
import * as util from 'util';

@Injectable()
export class RedisService {
  private sentinelServiceName: string;

  constructor(private configService: ConfigService) {
    this.sentinelServiceName = this.configService.get<string>(
      'REDIS_SENTINEL_SERVICE_NAME',
    );
  }

  async getRedisInstance() {
    let redisInstance: Redis;
    if (this.sentinelServiceName) {
      const sentinelName = this.configService.get<string>('REDIS_SENTINEL_NAME') || 'mymaster';
      const sentinelPassword = this.configService.getOrThrow('REDIS_SENTINEL_PASSWORD');
      const sentinels = await this.discoverSentinelHosts();
      console.log('Discovered sentinels:', sentinels);

      redisInstance = new Redis({
        sentinels,
        sentinelPassword,
        password: sentinelPassword,
        name: sentinelName,
      });
    } else {
      const redisUrl = this.configService.getOrThrow('REDIS');;
      redisInstance = new Redis(redisUrl);
    }

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
      console.error('Error during service discovery:', err);
      throw err;
    }
  }
}
