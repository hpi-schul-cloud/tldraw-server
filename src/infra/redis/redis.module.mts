import { Module } from '@nestjs/common';
import { LoggerModule } from '../logging/logger.module.mjs';
import { RedisService } from './redis.service.mjs';

@Module({
    imports: [LoggerModule],
    providers: [RedisService],
    exports: [RedisService],
})
export class RedisModule {}
