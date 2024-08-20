import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '../../infra/redis/redis.module.mjs';
import { StorageModule } from '../../infra/storage/storage.module.mjs';
import { WorkerService } from './domain/worker.service.mjs';

@Module({
  imports: [ConfigModule.forRoot({isGlobal: true}), RedisModule, StorageModule],
  providers: [
    WorkerService
  ],
})
export class WorkerModule {}
