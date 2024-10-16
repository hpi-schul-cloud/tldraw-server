import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../configuration/configuration.module.js';
import { LoggerModule } from '../logging/logger.module.js';
import { RedisConfig } from './redis.config.js';
import { RedisService } from './redis.service.js';

@Module({
	imports: [LoggerModule, ConfigurationModule.register(RedisConfig)],
	providers: [RedisService],
	exports: [RedisService],
})
export class RedisModule {}
