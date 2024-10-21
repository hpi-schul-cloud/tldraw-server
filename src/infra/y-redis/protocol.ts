import * as array from 'lib0/array';
import * as buffer from 'lib0/buffer';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import * as error from 'lib0/error';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as Y from 'yjs';

export const messageSync = 0;
export const messageAwareness = 1;
export const messageAuth = 2;
export const messageQueryAwareness = 3;

export const messageSyncStep1 = 0;
export const messageSyncStep2 = 1;
export const messageSyncUpdate = 2;

/**
 * @todo this should emit a single message
 *
 * Merge messages for easier comsumption by the client.
 *
 * This is useful, for example, when the server catches messages from a pubsub / stream.
 * Before the server sends the messages to the clients, we can merge updates, and filter out older
 * awareness messages.
 *
 */
export const mergeMessages = (messages: Uint8Array[]): Uint8Array[] => {
	if (messages.length < 2) {
		return messages;
	}
	const aw = new awarenessProtocol.Awareness(new Y.Doc());

	const updates: Uint8Array[] = [];
	messages.forEach((m) => {
		const decoder = decoding.createDecoder(m);
		try {
			const messageType = decoding.readUint8(decoder);
			switch (messageType) {
				case messageSync: {
					const syncType = decoding.readUint8(decoder);
					if (syncType === messageSyncUpdate) {
						updates.push(decoding.readVarUint8Array(decoder));
					} else {
						error.unexpectedCase();
					}
					break;
				}
				case messageAwareness: {
					awarenessProtocol.applyAwarenessUpdate(aw, decoding.readVarUint8Array(decoder), null);
					break;
				}
				default: {
					error.unexpectedCase();
				}
			}
		} catch (e) {
			console.log('PROTOCOL: Error parsing message', buffer.toBase64(m), e);
		}
	});

	const result: Uint8Array[] = [];
	updates.length > 0 &&
		result.push(
			encoding.encode((encoder) => {
				encoding.writeVarUint(encoder, messageSync);
				encoding.writeVarUint(encoder, messageSyncUpdate); // update
				encoding.writeVarUint8Array(encoder, Y.mergeUpdates(updates));
			}),
		);
	aw.states.size > 0 &&
		result.push(
			encoding.encode((encoder) => {
				encoding.writeVarUint(encoder, messageAwareness);
				encoding.writeVarUint8Array(
					encoder,
					awarenessProtocol.encodeAwarenessUpdate(aw, array.from(aw.getStates().keys())),
				);
			}),
		);

	return result;
};

export const encodeSyncStep1 = (sv: Uint8Array): Uint8Array =>
	encoding.encode((encoder) => {
		encoding.writeVarUint(encoder, messageSync);
		encoding.writeVarUint(encoder, messageSyncStep1);
		encoding.writeVarUint8Array(encoder, sv);
	});

export const encodeSyncStep2 = (diff: Uint8Array): Uint8Array =>
	encoding.encode((encoder) => {
		encoding.writeVarUint(encoder, messageSync);
		encoding.writeVarUint(encoder, messageSyncStep2);
		encoding.writeVarUint8Array(encoder, diff);
	});

export const encodeAwarenessUpdate = (awareness: awarenessProtocol.Awareness, clients: number[]): Uint8Array =>
	encoding.encode((encoder) => {
		encoding.writeVarUint(encoder, messageAwareness);
		encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, clients));
	});

export const encodeAwarenessUserDisconnected = (clientid: number, lastClock: number): Uint8Array =>
	encoding.encode((encoder) => {
		encoding.writeVarUint(encoder, messageAwareness);
		encoding.writeVarUint8Array(
			encoder,
			encoding.encode((encoder) => {
				encoding.writeVarUint(encoder, 1); // one change
				encoding.writeVarUint(encoder, clientid);
				encoding.writeVarUint(encoder, lastClock + 1);
				encoding.writeVarString(encoder, JSON.stringify(null));
			}),
		);
	});
