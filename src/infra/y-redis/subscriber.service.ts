/* This file contains the implementation of the functions,
    which was copied from the y-redis repository.
	Adopting this code allows us to integrate proven and
	optimized logic into the current project.
	The original code from the `y-redis` repository is licensed under the AGPL-3.0 license.
	https://github.com/yjs/y-redis
*/
import * as map from 'lib0/map';
import { Api } from './api.service.js';
import { isSmallerRedisId } from './helper.js';

export const running = true;

type SubscriptionHandler = (stream: string, message: Uint8Array[]) => void;
interface Subscriptions {
	fs: Set<SubscriptionHandler>;
	id: string;
	nextId?: string | null;
}

export class Subscriber {
	public readonly subscribers = new Map<string, Subscriptions>();

	public constructor(private readonly client: Api) {}

	public async start(): Promise<void> {
		console.log('Subscriber is running');
		while (running) {
			await this.run();
		}
	}

	public ensureSubId(stream: string, id: string): void {
		const sub = this.subscribers.get(stream);
		if (sub != null && isSmallerRedisId(id, sub.id)) {
			sub.nextId = id;
		}
	}

	public subscribe(stream: string, f: SubscriptionHandler): { redisId: string } {
		const sub = map.setIfUndefined(this.subscribers, stream, () => ({ fs: new Set(), id: '0', nextId: null }));
		sub.fs.add(f);

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
