import { encoding } from 'lib0';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as Y from 'yjs';
import {
	encodeAwarenessUpdate,
	encodeAwarenessUserDisconnected,
	encodeSyncStep1,
	encodeSyncStep2,
	mergeMessages,
} from './protocol.js';

const createMessage = (firstMessageType: number, secondMessageType: number, payload: Uint8Array): Uint8Array => {
	const encoder = encoding.createEncoder();
	encoding.writeUint8(encoder, firstMessageType);
	encoding.writeUint8(encoder, secondMessageType);
	encoding.writeVarUint8Array(encoder, payload);

	return encoding.toUint8Array(encoder);
};

describe('Protocol', () => {
	beforeEach(() => {
		jest.resetAllMocks();
	});

	describe('mergeMessages', () => {
		describe('when messages is empty', () => {
			it('should return an empty array', () => {
				const result = mergeMessages([]);

				expect(result).toEqual([]);
			});
		});

		describe('when messages contains one message', () => {
			it('should return the encoded message', () => {
				const message = new Uint8Array([1, 2, 3]);

				const result = mergeMessages([message]);

				expect(result).toEqual([new Uint8Array([1, 2, 3])]);
			});
		});

		describe('when messages contains two messages', () => {
			describe('when the first message is a sync and update and second message is awareness and update', () => {
				const setup = () => {
					// Create a valid Yjs v1 update
					const ydoc = new Y.Doc();
					const update = Y.encodeStateAsUpdate(ydoc);
					ydoc.destroy();

					// Proper sync message: [messageSync, messageSyncUpdate, varUint8Array(update)]
					const syncEncoder = encoding.createEncoder();
					encoding.writeUint8(syncEncoder, 0);
					encoding.writeUint8(syncEncoder, 2);
					encoding.writeVarUint8Array(syncEncoder, update);
					const syncMsg = encoding.toUint8Array(syncEncoder);

					// Create a valid awareness update
					const aDoc = new Y.Doc();
					const aw = new awarenessProtocol.Awareness(aDoc);
					aw.setLocalState({ cursor: 'test' });
					const awarenessPayload = awarenessProtocol.encodeAwarenessUpdate(aw, [aDoc.clientID]);
					aw.destroy();
					aDoc.destroy();

					// Proper awareness message: [messageAwareness, varUint8Array(awarenessPayload)]
					const awEncoder = encoding.createEncoder();
					encoding.writeUint8(awEncoder, 1);
					encoding.writeVarUint8Array(awEncoder, awarenessPayload);
					const awarenessMsg = encoding.toUint8Array(awEncoder);

					// Pre-compute expected sync result
					const expectedSyncEncoder = encoding.createEncoder();
					encoding.writeUint8(expectedSyncEncoder, 0);
					encoding.writeUint8(expectedSyncEncoder, 2);
					encoding.writeVarUint8Array(expectedSyncEncoder, Y.mergeUpdates([update]));
					const expectedSyncMsg = encoding.toUint8Array(expectedSyncEncoder);

					return { messages: [syncMsg, awarenessMsg], expectedSyncMsg };
				};

				it('should return the encoded sync message', () => {
					const { messages, expectedSyncMsg } = setup();

					const result = mergeMessages(messages);

					expect(result).toHaveLength(2);
					expect(result[0]).toEqual(expectedSyncMsg);
					expect(result[1][0]).toBe(1); // messageAwareness
				});
			});
		});

		describe('when messages contains two unknown message types', () => {
			it('should throw an error', () => {
				const messages = [
					createMessage(99, 99, new Uint8Array([1, 2, 3])),
					createMessage(99, 99, new Uint8Array([1, 2, 3])),
				];

				expect(() => mergeMessages(messages)).toThrow();
			});
		});

		describe('when the first message contains sync and unknown and the second awareness and unknown', () => {
			it('should throw an error', () => {
				const messages = [
					createMessage(0, 99, new Uint8Array([1, 2, 3])),
					createMessage(1, 99, new Uint8Array([1, 2, 3])),
				];

				expect(() => mergeMessages(messages)).toThrow();
			});
		});
	});

	describe('encodeSyncStep1', () => {
		it('should return the encoded sync step 1 message', () => {
			const sv = new Uint8Array([1, 2, 3]);

			const result = encodeSyncStep1(sv);

			expect(result).toEqual(new Uint8Array([0, 0, 3, 1, 2, 3]));
		});
	});

	describe('encodeSyncStep2', () => {
		it('should return the encoded sync step 2 message', () => {
			const diff = new Uint8Array([4, 5, 6]);

			const result = encodeSyncStep2(diff);

			expect(result).toEqual(new Uint8Array([0, 1, 3, 4, 5, 6]));
		});
	});

	describe('encodeAwarenessUpdate', () => {
		const setup = () => {
			const ydoc = new Y.Doc();
			const awareness = new awarenessProtocol.Awareness(ydoc);
			awareness.setLocalState({ cursor: 'test' });
			const clients = [ydoc.clientID];
			const awarenessPayload = awarenessProtocol.encodeAwarenessUpdate(awareness, clients);

			const expectedEncoder = encoding.createEncoder();
			encoding.writeUint8(expectedEncoder, 1); // messageAwareness
			encoding.writeVarUint8Array(expectedEncoder, awarenessPayload);
			const expectedResult = encoding.toUint8Array(expectedEncoder);

			return { awareness, clients, expectedResult, ydoc };
		};

		it('should call encodeAwarenessUpdate with awareness and clients', () => {
			const { awareness, clients, expectedResult, ydoc } = setup();

			const result = encodeAwarenessUpdate(awareness, clients);

			expect(result).toEqual(expectedResult);
			awareness.destroy();
			ydoc.destroy();
		});

		it('should return the encoded awareness update message', () => {
			const { awareness, clients, expectedResult, ydoc } = setup();

			const result = encodeAwarenessUpdate(awareness, clients);

			expect(result).toEqual(expectedResult);
			awareness.destroy();
			ydoc.destroy();
		});
	});

	describe('encodeAwarenessUserDisconnected', () => {
		it('should return the encoded awareness user disconnected message', () => {
			const clientid = 1;
			const lastClock = 2;

			const result = encodeAwarenessUserDisconnected(clientid, lastClock);

			expect(result).toEqual(new Uint8Array([1, 8, 1, 1, 3, 4, 110, 117, 108, 108]));
		});
	});
});
