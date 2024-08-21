import { Controller, Get } from '@nestjs/common';
import { MetricsService } from '../domain/metrics.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: MetricsService) {}

  @Get('/metrics')
  getMetrics(): Promise<string> {
    return this.appService.getMetrics();
  }
}
