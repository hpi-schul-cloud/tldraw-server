import { Module } from '@nestjs/common';
import { RedisService } from './redis.service.mjs';

@Module({
    providers: [RedisService],
    exports: [RedisService],
})
export class RedisModule {}
