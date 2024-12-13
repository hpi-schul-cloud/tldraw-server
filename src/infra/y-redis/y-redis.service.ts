import { Injectable } from '@nestjs/common';
import { encoding } from 'lib0';
import * as array from 'lib0/array';
import * as decoding from 'lib0/decoding';
import { Awareness } from 'y-protocols/awareness.js';
import { Doc, encodeStateAsUpdate, encodeStateVector } from 'yjs';
import { isSmallerRedisId } from './helper.js';
import * as protocol from './protocol.js';
import { SubscriberService, SubscriptionHandler } from './subscriber.service.js';
import { YRedisDoc } from './y-redis-doc.js';
import { YRedisUser } from './y-redis-user.js';

@Injectable()
export class YRedisService {
	public constructor(private readonly subscriberService: SubscriberService) {}

	// subscriber wrappers
	public async start(): Promise<void> {
		await this.subscriberService.start();
	}

	public subscribe(stream: string, callback: SubscriptionHandler): { redisId: string } {
		const { redisId } = this.subscriberService.subscribe(stream, callback);

		return { redisId };
	}

	public unsubscribe(stream: string, callback: SubscriptionHandler): void {
		this.subscriberService.unsubscribe(stream, callback);
	}

	public ensureLatestContentSubscription(yRedisDoc: YRedisDoc, yRedisUser: YRedisUser): void {
		if (isSmallerRedisId(yRedisDoc.redisLastId, yRedisUser.initialRedisSubId)) {
			// our subscription is newer than the content that we received from the y-redis-client
			// need to renew subscription id and make sure that we catch the latest content.
			this.subscriberService.ensureSubId(yRedisDoc.streamName, yRedisDoc.redisLastId);
		}
	}

	// state helper
	public filterMessageForPropagation(messageBuffer: ArrayBuffer, yRedisUser: YRedisUser): Buffer | null {
		const messageBufferCopy = this.copyMessageBuffer(messageBuffer);
		const message = Buffer.from(messageBufferCopy);

		if (this.isSyncUpdateAndSyncStep2(message)) {
			return message;
		}

		if (this.isAwarenessUpdate(message)) {
			this.updateUserAwareness(message, yRedisUser);

			return message;
		}

		if (this.isSyncMessageStep1(message)) {
			// can be safely ignored because we send the full initial state at the beginning
			return null;
		}

		throw new Error(`Unexpected message type ${message}`);
	}

	public createAwarenessUserDisconnectedMessage(yRedisUser: YRedisUser): Buffer {
		if (!yRedisUser.awarenessId) {
			throw new Error('Missing awarenessId in YRedisUser.');
		}

		const awarenessMessage = Buffer.from(
			protocol.encodeAwarenessUserDisconnected(yRedisUser.awarenessId, yRedisUser.awarenessLastClock),
		);

		return awarenessMessage;
	}

	public encodeSyncStep1StateVectorMessage(yDoc: Doc): Uint8Array {
		const message = protocol.encodeSyncStep1(encodeStateVector(yDoc));

		return message;
	}

	public encodeSyncStep2StateAsUpdateMessage(ydoc: Doc): Uint8Array {
		const message = protocol.encodeSyncStep2(encodeStateAsUpdate(ydoc));

		return message;
	}

	public encodeAwarenessUpdateMessage(awareness: Awareness): Uint8Array {
		const message = protocol.encodeAwarenessUpdate(awareness, array.from(awareness.states.keys()));

		return message;
	}

	public mergeMessagesToMessage(messages: Uint8Array[]): Uint8Array {
		const mergedMessage = messages.length === 1 ? messages[0] : this.useEncodingToMergeMessages(messages);

		return mergedMessage;
	}

	// private
	private useEncodingToMergeMessages(messages: Uint8Array[]): Uint8Array {
		const mergedMessage = encoding.encode((encoder) =>
			messages.forEach((message) => {
				encoding.writeUint8Array(encoder, message);
			}),
		);

		return mergedMessage;
	}

	private copyMessageBuffer(messageBuffer: ArrayBuffer): ArrayBuffer {
		const messageBufferCopy = messageBuffer.slice(0, messageBuffer.byteLength);

		return messageBufferCopy;
	}

	private isSyncMessageStep1(message: Buffer): boolean {
		return message[0] === protocol.messageSync && message[1] === protocol.messageSyncStep1;
	}

	private isSyncUpdateAndSyncStep2(message: Buffer): boolean {
		return (
			message[0] === protocol.messageSync &&
			(message[1] === protocol.messageSyncUpdate || message[1] === protocol.messageSyncStep2)
		);
	}

	private isAwarenessUpdate(message: Buffer): boolean {
		return message[0] === protocol.messageAwareness;
	}

	private updateUserAwareness(message: Buffer, yRedisUser: YRedisUser): void {
		const decoder = decoding.createDecoder(message);
		decoding.readVarUint(decoder); // read message type
		decoding.readVarUint(decoder); // read length of awareness update
		const alen = decoding.readVarUint(decoder); // number of awareness updates
		const awId = decoding.readVarUint(decoder);
		if (alen === 1 && (yRedisUser.awarenessId === null || yRedisUser.awarenessId === awId)) {
			// only update awareness if len=1
			yRedisUser.awarenessId = awId;
			yRedisUser.awarenessLastClock = decoding.readVarUint(decoder);
		}
	}
}
