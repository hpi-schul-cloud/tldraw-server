import { number } from 'lib0';
import * as env from 'lib0/environment';
import { Gauge, Histogram, register } from 'prom-client';
import * as uws from 'uws';
import { Api } from '@y/redis';

const openConnectionsGauge = new Gauge({
	name: 'tldraw_open_connections',
	help: 'Number of open WebSocket connections on tldraw-server.',
});

export const incOpenConnectionsGauge = () => {
	openConnectionsGauge.inc();
};

export const decOpenConnectionsGauge = () => {
	openConnectionsGauge.dec();
};

export const exposeMetricsToPrometheus = () => {
	const route = env.getConf('prometheus-metrics-route') ?? '/metrics';
	const port = number.parseInt(env.getConf('prometheus-metrics-port') ?? '9090');

	const app = uws.App({});

	app.get(route, async (res) => {
		const metrics = await register.metrics();
		res.end(metrics);
	});

	app.listen(port, () => {
		console.log('Prometheus metrics exposed on port 9090');
	});
};

// The below histogram for getDoc uses monkey patching and is only for testing the POC. It has to be removed in the final implementation.
const methodDurationHistogram = new Histogram({
	name: 'tldraw_getDoc_duration_seconds',
	help: 'Duration of getDoc in seconds',
	labelNames: ['method'],
});

const originalGetDoc = Api.prototype.getDoc;

Api.prototype.getDoc = async function (room, docId) {
	const end = methodDurationHistogram.startTimer();

	try {
		const result = await originalGetDoc.call(this, room, docId);
		end({ method: 'getDoc' });
		return result;
	} catch (error) {
		end({ method: 'getDoc', error: true });
		throw error;
	}
};
