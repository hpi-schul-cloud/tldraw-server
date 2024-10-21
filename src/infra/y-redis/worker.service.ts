import { RedisService } from '../../infra/redis/redis.service.js';
import { Api, createApiClient } from './api.service.js';
import { DocumentStorage } from './storage.js';

export const createWorker = async (
	store: DocumentStorage,
	redisPrefix: string,
	createRedisInstance: RedisService,
	tryClaimCount?: number,
): Promise<Worker> => {
	const a = await createApiClient(store, redisPrefix, createRedisInstance);

	return new Worker(a, tryClaimCount);
};

export class Worker {
	/**
	 * @param {Api} client
	 * @param {WorkerOpts} opts
	 */
	public constructor(
		public readonly client: Api,
		public readonly tryClaimCount?: number,
	) {
		this.client = client;
	}

	public async run(): Promise<void> {
		console.log('WORKER: Created worker process ');
		while (!this.client._destroyed) {
			try {
				await this.client.consumeWorkerQueue(this.tryClaimCount);
			} catch (e) {
				console.error(e);
			}
		}
		console.log('WORKER: Ended worker process ');
	}
}
