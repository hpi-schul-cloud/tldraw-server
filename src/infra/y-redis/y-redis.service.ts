/* This file contains the implementation of the functions,
    which was copied from the y-redis repository.
	Adopting this code allows us to integrate proven and
	optimized logic into the current project.
	The original code from the `y-redis` repository is licensed under the AGPL-3.0 license.
	https://github.com/yjs/y-redis
*/
/* eslint-disable max-classes-per-file */
import { Injectable } from '@nestjs/common';
import * as array from 'lib0/array';
import * as decoding from 'lib0/decoding';
import { Awareness } from 'y-protocols/awareness.js';
import { Doc, encodeStateAsUpdate, encodeStateVector } from 'yjs';
import * as protocol from './protocol.js';
import { YRedisUser } from './y-redis-user.js';

@Injectable()
export class YRedisService {
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

	public createYRedisUser(userProps: YRedisUser): YRedisUser {
		const yRedisUser = new YRedisUser(userProps.room, userProps.hasWriteAccess, userProps.userid, userProps.error);

		return yRedisUser;
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
