import { RedisService } from 'infra/redis/redis.service.js';
import { Api, createApiClient } from './api.service.js';
import { isSmallerRedisId } from './helper.js';
import { DocumentStorage } from './storage.js';

type SubscriptionHandler = (stream: string, message: Uint8Array[]) => void;
interface Subscriptions {
	fs: Set<SubscriptionHandler>;
	id: string;
	nextId?: string | null;
}
export const createSubscriber = async (
	store: DocumentStorage,
	redisPrefix: string,
	createRedisInstance: RedisService,
): Promise<Subscriber> => {
	const client = await createApiClient(store, redisPrefix, createRedisInstance);

	return new Subscriber(client);
};

export class Subscriber {
	private readonly subscribers = new Map<string, Subscriptions>();

	public constructor(private readonly client: Api) {
		this.run();
	}

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

	private async run(): Promise<void> {
		while (true) {
			try {
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
			} catch (e) {
				console.error(e);
			}
		}
	}
}
