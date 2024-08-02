import { number } from 'lib0';
import * as env from 'lib0/environment';
import { Gauge, register } from 'prom-client';
import * as uws from 'uws';

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
