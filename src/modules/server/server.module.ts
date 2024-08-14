import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TemplatedApp } from 'uws';
import { AppController } from './api/app.controller.js';
import { AuthorizationService } from './domain/authorization.service.js';
import { MetricsService } from './domain/metrics.service.js';
import { RedisService } from './domain/redis.service.js';
import { StorageService } from './domain/storage.service.js';
import { WebsocketService } from './domain/websocket.service.js';

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [AppController],
  providers: [
    MetricsService,
    AuthorizationService,
    RedisService,
    StorageService,
    WebsocketService,
  ],
})
export class ServerModule {
  static register(uws: TemplatedApp): any {
    return {
      module: ServerModule,
      providers: [
        {
          provide: 'UWS',
          useValue: uws,
        },
      ],
    };
  }
}
