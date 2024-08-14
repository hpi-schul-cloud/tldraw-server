import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisService } from '../server/domain/redis.service.js';
import { StorageService } from '../server/domain/storage.service.js';
import { WorkerService } from './domain/worker.service.js';

@Module({
  imports: [ConfigModule.forRoot()],
  providers: [
    RedisService,
    StorageService,
    WorkerService
  ],
})
export class WorkerModule {}
