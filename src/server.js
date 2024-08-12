import { registerYWebsocketServer } from '@y/redis';
import * as env from 'lib0/environment';
import * as error from 'lib0/error';
import * as logging from 'lib0/logging';
import * as number from 'lib0/number';
import * as promise from 'lib0/promise';
import * as uws from 'uws';
import { decOpenConnectionsGauge, exposeMetricsToPrometheus, incOpenConnectionsGauge } from './metrics.js';
import { redis } from './redis.js';
import { initStorage } from './storage.js';
import { exposeDocAnalysisEndpoint } from './doc-analysis.js';

const apiHost = env.getConf('api-host') || 'http://localhost:3030';
const wsPathPrefix = env.getConf('ws-path-prefix') || '';

class YWebsocketServer {
	/**
	 * @param {uws.TemplatedApp} app
	 */
	constructor(app) {
		this.app = app;
	}

	async destroy() {
		this.app.close();
	}
}

export const createYWebsocketServer = async ({ redisPrefix = 'y', port, store }) => {
	const app = uws.App({});

	await registerYWebsocketServer(
		app,
		`${wsPathPrefix}/:room`,
		store,
		checkAuthz,
		{
			redisPrefix,
			openWsCallback,
			closeWsCallback,
		},
		redis,
	);

	await promise.create((resolve, reject) => {
		app.listen(port, (token) => {
			if (token) {
				logging.print(logging.GREEN, '[y-redis] Listening to port ', port);
				resolve();
			} else {
				const err = error.create('[y-redis] Failed to lisen to port ' + port);
				reject(err);
				throw err;
			}
		});
	});

	return new YWebsocketServer(app);
};

const checkAuthz = async (req) => {
	const room = req.getParameter(0);
	const headerWsProtocol = req.getHeader('sec-websocket-protocol');
	const [, , token] = /(^|,)yauth-(((?!,).)*)/.exec(headerWsProtocol) ?? [null, null, req.getQuery('yauth')];
	if (token == null) {
		throw new Error('Missing Token');
	}

	const requestOptions = createAuthzRequestOptions(room, token);
	const response = await fetch(`${apiHost}/api/v3/authorization/by-reference`, requestOptions);

	const { userId } = await response.json();

	if (!response.ok) {
		throw new Error('Authorization failed');
	}

	const result = { hasWriteAccess: true, room, userid: userId };

	return result;
};

const createAuthzRequestOptions = (room, token) => {
	const requestOptions = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: 'Bearer ' + token,
		},
		body: JSON.stringify({
			context: {
				action: 'read',
				requiredPermissions: ['COURSE_EDIT'],
			},
			referenceType: 'boardnodes',
			referenceId: room,
		}),
	};

	return requestOptions;
};

const openWsCallback = () => {
	incOpenConnectionsGauge();
};

const closeWsCallback = () => {
	decOpenConnectionsGauge();
};

const port = number.parseInt(env.getConf('port') || '3345');
const redisPrefix = env.getConf('redis-prefix') || 'y';
const store = await initStorage();

if (env.getConf('feature-prometheus-metrics-enabled') === 'true') {
	exposeMetricsToPrometheus();
}

await exposeDocAnalysisEndpoint({ store });

createYWebsocketServer({ port, store, redisPrefix });
