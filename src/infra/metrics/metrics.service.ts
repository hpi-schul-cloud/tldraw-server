import { Injectable } from '@nestjs/common';
import { Gauge, Histogram, register } from 'prom-client';

@Injectable()
export class MetricsService {
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
