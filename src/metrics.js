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
	const app = uws.App({});

	app.get('/metrics', async (res) => {
		const metrics = await register.metrics();
		res.end(metrics);
	});

	app.listen(9090, () => {
		console.log('Prometheus metrics exposed on port 9090');
	});
};
