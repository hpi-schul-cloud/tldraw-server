/* This file contains the implementation of the functions,
    which was copied from the y-redis repository.
	Adopting this code allows us to integrate proven and
	optimized logic into the current project.
	The original code from the `y-redis` repository is licensed under the AGPL-3.0 license.
	https://github.com/yjs/y-redis
*/
import { randomUUID } from 'crypto';
import * as encoding from 'lib0/encoding';
import * as map from 'lib0/map';
import { RedisService } from '../redis/redis.service.js';
import { Api, createApiClient } from './api.service.js';
import { isSmallerRedisId } from './helper.js';
import * as protocol from './protocol.js';
import { DocumentStorage } from './storage.js';

export const running = true;

export const run = async (subscriber: Subscriber): Promise<void> => {
	while (running) {
		await subscriber.run();
	}
};
const isAwarenessUpdate = (message: Buffer): boolean => message[0] === protocol.messageAwareness;

type SubscriptionHandler = (stream: string, message: Uint8Array[]) => void;
interface Subscriptions {
	fs: Set<SubscriptionHandler>;
	id: string;
	nextId?: string | null;
	otherId?: string;
}
export const createSubscriber = async (
	store: DocumentStorage,
	createRedisInstance: RedisService,
): Promise<Subscriber> => {
	const client = await createApiClient(store, createRedisInstance);
	const subscriber = new Subscriber(client);
	// Here we are not using an "await", as it would block further execution
	// of our code, as the subscriber.run() is an infinite loop.
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

	public subscribe(stream: string, f: SubscriptionHandler): Subscriptions {
		const sub = map.setIfUndefined(this.subscribers, stream, () => ({
			fs: new Set(),
			id: '0',
			nextId: null,
			otherId: randomUUID(),
		}));
		sub.fs.add(f);

		return sub;
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
			if (sub == null) {
				console.log('Subscriber not found for stream', message.stream);
				continue;
			}
			const message0 =
				message.messages.length === 1
					? message.messages[0]
					: encoding.encode((encoder) =>
							message.messages.forEach((message) => {
								encoding.writeUint8Array(encoder, message);
							}),
						);
			const message1 = Buffer.from(message0.slice(0, message0.byteLength));

			if (!isAwarenessUpdate(message1)) {
				console.log('id', sub.id, 'message.lastId', message.lastId, 'nextId', sub.nextId, 'otherId', sub.otherId);
			}
			sub.id = message.lastId;
			if (sub.nextId != null) {
				sub.id = sub.nextId;
				sub.nextId = null;
			}
			sub.fs.forEach((f) => f(message.stream, message.messages));
		}
	}
}
