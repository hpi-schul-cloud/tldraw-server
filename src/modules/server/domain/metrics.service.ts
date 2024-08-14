import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Api } from '@y/redis';
import { Histogram, register } from 'prom-client';

@Injectable()
export class MetricsService {

  constructor(private configService: ConfigService) {}

  async getMetrics(): Promise<string> {
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

Api.prototype.getDoc = async function (room, docId) {
	const end = methodDurationHistogram.startTimer();

	const result = await originalGetDoc.call(this, room, docId);

	end();

	return result;
};