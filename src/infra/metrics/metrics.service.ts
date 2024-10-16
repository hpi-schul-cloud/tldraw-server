import { Injectable } from '@nestjs/common';
// @ts-expect-error - @y/redis is only having jsdoc types
import { Api } from '@y/redis';
import { Gauge, Histogram, register } from 'prom-client';

@Injectable()
export class MetricsService {
	public static readonly openConnectionsGauge = new Gauge({
		name: 'tldraw_open_connections',
		help: 'Number of open WebSocket connections on tldraw-server.',
	});

	public async getMetrics(): Promise<string> {
		const metrics = await register.metrics();

		return metrics;
	}
}

// The below histogram for getDoc uses monkey patching and is only for testing the POC. It has to be removed in the final implementation.
const methodDurationHistogram = new Histogram({
	name: 'tldraw_getDoc_duration_seconds',
	help: 'Duration of getDoc in seconds',
	buckets: [0.1, 0.2, 0.5, 1, 2, 5, 10],
});

const originalGetDoc = Api.prototype.getDoc;

Api.prototype.getDoc = async function (room: string, docId: string): Promise<unknown> {
	const end = methodDurationHistogram.startTimer();

	const result = await originalGetDoc.call(this, room, docId);

	end();

	return result;
};
