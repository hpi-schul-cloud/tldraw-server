import * as api from '@y/redis';
import { number } from 'lib0';
import * as env from 'lib0/environment';
import * as uws from 'uws';
import * as Y from 'yjs';

export const exposeDocAnalysisEndpoint = async ({ store }) => {
	const route = env.getConf('doc-analysis-route') ?? '/doc-analysis';
	const port = number.parseInt(env.getConf('doc-analysis-port') ?? '3346');

	const app = uws.App({});

	const client = await api.createApiClient(store, 'y');

	app.get(`${route}/:room`, async (res, req) => {
		res.onAborted(() => {
			res.aborted = true;
		});

		const room = req.getParameter(0);
		const doc = await client.getDoc(room, 'index');
		const pendingUpdate = doc.ydoc.store.pendingStructs?.update;

		if (!pendingUpdate) {
			res.end(`No pending update found for doc ${room}`);
		}

		const decodedPendingUpdate = Y.decodeUpdateV2(pendingUpdate);
		const clientsInPendingUpdate = [];

		decodedPendingUpdate.structs.forEach((struct) => {
			if (!clientsInPendingUpdate.find((client) => client.id === struct.id.client)) {
				clientsInPendingUpdate.push({ id: struct.id.client, count: 1 });
			} else {
				clientsInPendingUpdate.find((client) => client.id === struct.id.client).count += 1;
			}
		});

		res.end(JSON.stringify({ clientsInPendingUpdate, decodedPendingUpdate }));
	});

	app.listen(port, () => {
		console.log(`Doc analysis endpoint is listening on port ${port}`);
	});
};

const analyseForOriginFromArtilleryTest = (decodedUpdate) => {
	const clientsFromTest = decodedUpdate.structs
		.filter((struct) => struct.content.arr[0].text?.startsWith('Hel'))
		.map((struct) => struct.id.client);

	const uniqueClientsFromTest = new Set(clientsFromTest);

	const pendingUpdatesWithoutTextFromTest = decodedUpdate.structs
		.filter((struct) => !struct.content.arr[0].text)
		.filter((struct) => uniqueClientsFromTest.has(struct.id.client));

	const pendingUpdatesNotFromTest = decodedUpdate.structs.filter(
		(struct) => !uniqueClientsFromTest.has(struct.id.client),
	);

	console.log(pendingUpdatesNotFromTest);
};
