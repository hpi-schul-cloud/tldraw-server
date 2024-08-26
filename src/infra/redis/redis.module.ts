import { Module } from '@nestjs/common';
import { LoggerModule } from '../logging/logger.module.js';
import { RedisService } from './redis.service.js';

@Module({
	imports: [LoggerModule],
	providers: [RedisService],
	exports: [RedisService],
})
export class RedisModule {}
