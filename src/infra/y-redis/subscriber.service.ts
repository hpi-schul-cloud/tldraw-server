/* This file contains the implementation of the functions,
    which was copied from the y-redis repository.
	Adopting this code allows us to integrate proven and
	optimized logic into the current project.
	The original code from the `y-redis` repository is licensed under the AGPL-3.0 license.
	https://github.com/yjs/y-redis
*/
import { Injectable } from '@nestjs/common';
import { StreamNameClockPair } from 'infra/redis/interfaces/stream-name-clock-pair.js';
import * as map from 'lib0/map';
import { isSmallerRedisId } from './helper.js';
import { YRedisClient } from './y-redis.client.js';

export const running = true;

export type SubscriptionHandler = (stream: string, message: Uint8Array[]) => void;
interface Subscriptions {
	fs: Set<SubscriptionHandler>;
	id: string;
	nextId?: string | null;
}

@Injectable()
export class SubscriberService {
	public readonly subscribers = new Map<string, Subscriptions>();

	public constructor(private readonly yRedisClient: YRedisClient) {}

	public async start(): Promise<void> {
		while (running) {
			const streams = await this.run();
			await this.waitIfStreamsEmpty(streams);
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
		await this.yRedisClient.destroy();
	}

	private async waitIfStreamsEmpty(streams: StreamNameClockPair[], waitInMs = 50): Promise<void> {
		if (streams.length === 0) {
			await new Promise((resolve) => setTimeout(resolve, waitInMs));
		}
	}

	public async run(): Promise<StreamNameClockPair[]> {
		const streams = this.getSubscriberStreams();

		if (streams.length === 0) {
			return streams;
		}

		const messages = await this.yRedisClient.getMessages(streams);

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

		return streams;
	}

	private getSubscriberStreams(): StreamNameClockPair[] {
		const subscribers = Array.from(this.subscribers.entries());
		const streams = subscribers.map(([stream, s]) => ({ key: stream, id: s.id }));

		return streams;
	}
}
