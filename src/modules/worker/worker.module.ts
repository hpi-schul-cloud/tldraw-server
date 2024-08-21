import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '../../infra/redis/redis.module.js';
import { StorageModule } from '../../infra/storage/storage.module.js';
import { WorkerService } from './domain/worker.service.js';

@Module({
  imports: [ConfigModule.forRoot({isGlobal: true}), RedisModule, StorageModule],
  providers: [
    WorkerService
  ],
})
export class WorkerModule {}
