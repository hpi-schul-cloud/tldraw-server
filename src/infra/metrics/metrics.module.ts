
import { Module } from '@nestjs/common';
import { LoggerModule } from '../logging/logger.module.js';
import { MetricsController } from './api/metrics.controller.js';
import { MetricsService } from './metrics.service.js';

@Module({
    imports: [LoggerModule],
    controllers: [MetricsController],
    providers: [MetricsService],
})
export class MetricsModule {};