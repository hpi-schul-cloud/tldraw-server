import { Injectable, OnModuleInit } from '@nestjs/common';
import { collectDefaultMetrics, Gauge, Histogram, register } from 'prom-client';
import { MetricConfig } from './metrics.config.js';

@Injectable()
export class MetricsService implements OnModuleInit {
	public constructor(private config: MetricConfig) {}

	public onModuleInit(): void {
		if (this.config.METRICS_COLLECT_DEFAULT) {
			collectDefaultMetrics();
		}
	}

	public static readonly openConnectionsGauge = new Gauge({
		name: 'tldraw_open_connections',
		help: 'Number of open WebSocket connections on tldraw-server.',
	});

	public static readonly methodDurationHistogram = new Histogram({
		name: 'tldraw_getDoc_duration_seconds',
		help: 'Duration of getDoc in seconds',
		buckets: [0.1, 0.2, 0.5, 1, 2, 5, 10],
	});

	public async getMetrics(): Promise<string> {
		const metrics = await register.metrics();

		return metrics;
	}
}
