import { Module } from '@nestjs/common';
import { LoggerModule } from '../../infra/logger/index.js';
import { RedisModule } from '../../infra/redis/index.js';
import { StorageModule } from '../../infra/storage/index.js';
import { YRedisClientModule } from '../../infra/y-redis/index.js';
import { CliService } from './cli.service.js';
import { REDIS_FOR_CLI } from './cli.const.js';

@Module({
	imports: [RedisModule.registerFor(REDIS_FOR_CLI), StorageModule, LoggerModule, YRedisClientModule.register()],
	providers: [CliService],
})
export class CliModule {}
