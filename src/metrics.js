import { number } from 'lib0';
import * as env from 'lib0/environment';
import { Gauge, register } from 'prom-client';
import * as uws from 'uws';

const openConnectionsGauge = new Gauge({ name: 'open_connections', help: 'Number of open WebSocket connections' });

export const incOpenConnectionsGauge = () => {
	openConnectionsGauge.inc();
};

export const decOpenConnectionsGauge = () => {
	openConnectionsGauge.dec();
};

export const exposeMetricsToPrometheus = () => {
	const route = env.getConf('prometheus-metrics-route');
	const port = number.parseInt(env.getConf('prometheus-metrics-port'));

	const app = uws.App({});

	app.get(route, async (res) => {
		const metrics = await register.metrics();
		res.end(metrics);
	});

	app.listen(port, () => {
		console.log('Prometheus metrics exposed on port 9090');
	});
};
