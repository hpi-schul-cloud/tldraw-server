
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWorker } from '@y/redis';
import { RedisService } from '../../server/domain/redis.service.js';
import { StorageService } from '../../server/domain/storage.service.js';

@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
    constructor(
        private storage: StorageService,
        private redisService: RedisService,
        private configService: ConfigService
    ) {}

    async onModuleInit() {
          await createWorker(
            await this.storage.get(),
            this.configService.get<string>('REDIS_PREFIX') || "y",
            {},
            await this.redisService.getRedisInstance(),
          );
    }
    onModuleDestroy() {
        throw new Error('Method not implemented.');
    }
}