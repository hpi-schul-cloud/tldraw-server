import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { registerYWebsocketServer } from '@y/redis';
import { Gauge } from 'prom-client';
import { TemplatedApp } from 'uws';
import { AuthorizationService } from './authorization.service.js';
import { RedisService } from './redis.service.js';
import { StorageService } from './storage.service.js';

@Injectable()
export class WebsocketService implements OnModuleInit, OnModuleDestroy {

  private openConnectionsGauge = new Gauge({
    name: 'tldraw_open_connections',
    help: 'Number of open WebSocket connections on tldraw-server.',
  });

  constructor(
    @Inject('UWS') private app: TemplatedApp,
    private storage: StorageService,
    private authorizationService: AuthorizationService,
    private redisService: RedisService,
    private configService: ConfigService
  ) {}

  onModuleDestroy() {
    this.app.close();
  }

  async onModuleInit() {
    await registerYWebsocketServer(
      this.app,
      this.configService.get<string>('WS_PATH_PREFIX'),
      await this.storage.get(),
      this.authorizationService.hasPermission.bind(this.authorizationService),
      {
        redisPrefix: this.configService.get<string>('REDIS_PREFIX') || "y",
        openWsCallback: () => this.incOpenConnectionsGauge(),
        closeWsCallback: () => this.decOpenConnectionsGauge(),
      },
      await this.redisService.getRedisInstance(),
    );
  }

  private incOpenConnectionsGauge() {
    this.openConnectionsGauge.inc();
  };

  private decOpenConnectionsGauge() {
    this.openConnectionsGauge.dec();
  };
}
