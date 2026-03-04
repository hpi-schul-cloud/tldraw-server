import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../configuration/configuration.module.js';
import { LoggerModule } from '../logger/logger.module.js';
import { MetricsController } from './api/metrics.controller.js';
import { METRICS_CONFIG, MetricConfig } from './metrics.config.js';
import { MetricsService } from './metrics.service.js';

@Module({
	imports: [LoggerModule, ConfigurationModule.register(METRICS_CONFIG, MetricConfig)],
	controllers: [MetricsController],
	providers: [MetricsService],
})
export class MetricsModule {}
