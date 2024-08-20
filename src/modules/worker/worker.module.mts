import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisService } from '../../infra/redis/redis.service.mjs';
import { StorageService } from '../../infra/storage/storage.service.mjs';
import { WorkerService } from './domain/worker.service.mjs';

@Module({
  imports: [ConfigModule.forRoot({isGlobal: true})],
  providers: [
    RedisService,
    StorageService,
    WorkerService
  ],
})
export class WorkerModule {}
