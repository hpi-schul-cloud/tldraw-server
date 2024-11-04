/* This file contains the implementation of the functions,
    which was copied from the y-redis repository.
	Adopting this code allows us to integrate proven and
	optimized logic into the current project.
	The original code from the `y-redis` repository is licensed under the AGPL-3.0 license.
	By adhering to the license terms, we ensure that the use of the code from the `y-redis` repository is legally compliant.
*/
import { RedisService } from '../redis/redis.service.js';
import { Api, createApiClient } from './api.service.js';
import { isSmallerRedisId } from './helper.js';
import { DocumentStorage } from './storage.js';

const run = async (subscriber: Subscriber): Promise<void> => {
	while (true) {
		await subscriber.run();
	}
};

type SubscriptionHandler = (stream: string, message: Uint8Array[]) => void;
interface Subscriptions {
	fs: Set<SubscriptionHandler>;
	id: string;
	nextId?: string | null;
}
export const createSubscriber = async (
	store: DocumentStorage,
	createRedisInstance: RedisService,
): Promise<Subscriber> => {
	const client = await createApiClient(store, createRedisInstance);
	const subscriber = new Subscriber(client);
	run(subscriber);

	return subscriber;
};

export class Subscriber {
	public readonly subscribers = new Map<string, Subscriptions>();

	public constructor(private readonly client: Api) {}

	public ensureSubId(stream: string, id: string): void {
		const sub = this.subscribers.get(stream);
		if (sub != null && isSmallerRedisId(id, sub.id)) {
			sub.nextId = id;
		}
	}

	public subscribe(stream: string, f: SubscriptionHandler): { redisId: string } {
		const sub = this.subscribers.get(stream) ?? { fs: new Set<SubscriptionHandler>(), id: '0', nextId: null };
		sub.fs.add(f);

		if (!this.subscribers.has(stream)) {
			this.subscribers.set(stream, sub);
		}

		return {
			redisId: sub.id,
		};
	}

	public unsubscribe(stream: string, f: SubscriptionHandler): void {
		const sub = this.subscribers.get(stream);
		if (sub) {
			sub.fs.delete(f);
			if (sub.fs.size === 0) {
				this.subscribers.delete(stream);
			}
		}
	}

	public async destroy(): Promise<void> {
		await this.client.destroy();
	}

	public async run(): Promise<void> {
		const messages = await this.client.getMessages(
			Array.from(this.subscribers.entries()).map(([stream, s]) => ({ key: stream, id: s.id })),
		);

		for (const message of messages) {
			const sub = this.subscribers.get(message.stream);
			if (sub == null) continue;
			sub.id = message.lastId;
			if (sub.nextId != null) {
				sub.id = sub.nextId;
				sub.nextId = null;
			}
			sub.fs.forEach((f) => f(message.stream, message.messages));
		}
	}
}
