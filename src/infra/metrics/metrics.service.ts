import { Injectable } from '@nestjs/common';
import { Gauge, Histogram, register } from 'prom-client';
import { Awareness } from 'y-protocols/awareness.js';
import { Doc } from 'yjs';
import { Api } from '../y-redis/api.service.js';

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

Api.prototype.getDoc = async function (
	room: string,
	docId: string,
): Promise<{
	ydoc: Doc;
	awareness: Awareness;
	redisLastId: string;
	storeReferences: string[] | null;
	docChanged: boolean;
}> {
	const end = methodDurationHistogram.startTimer();

	const result = await originalGetDoc.call(this, room, docId);

	end();

	return result;
};
