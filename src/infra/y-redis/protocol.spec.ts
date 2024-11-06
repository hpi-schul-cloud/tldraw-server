import { createMock } from '@golevelup/ts-jest';
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
					const messages = [
						createMessage(0, 2, new Uint8Array([1, 2, 3])),
						createMessage(1, 2, new Uint8Array([1, 2, 3])),
					];
					const mergeUpdatesSpy = jest.spyOn(Y, 'mergeUpdates').mockReturnValueOnce(new Uint8Array([1, 2, 3]));
					const applyAwarenessUpdateSpy = jest.spyOn(awarenessProtocol, 'applyAwarenessUpdate').mockReturnValueOnce();
					const encodeAwarenessUpdateSpy = jest
						.spyOn(awarenessProtocol, 'encodeAwarenessUpdate')
						.mockReturnValueOnce(new Uint8Array([1, 2, 3]));

					return { messages, mergeUpdatesSpy, applyAwarenessUpdateSpy, encodeAwarenessUpdateSpy };
				};

				it('should return the encoded sync message', () => {
					const { messages, mergeUpdatesSpy, applyAwarenessUpdateSpy, encodeAwarenessUpdateSpy } = setup();

					const result = mergeMessages(messages);

					expect(mergeUpdatesSpy).toHaveBeenCalledWith([new Uint8Array([1, 2, 3])]);
					expect(applyAwarenessUpdateSpy).toHaveBeenCalledWith(
						expect.any(awarenessProtocol.Awareness),
						new Uint8Array([3, 1]),
						null,
					);
					expect(encodeAwarenessUpdateSpy).toHaveBeenCalledWith(
						expect.any(awarenessProtocol.Awareness),
						expect.any(Array),
					);
					expect(result).toEqual([new Uint8Array([0, 2, 3, 1, 2, 3]), new Uint8Array([1, 3, 1, 2, 3])]);
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
			const awareness = createMock<awarenessProtocol.Awareness>();
			const encodeSpy = jest
				.spyOn(awarenessProtocol, 'encodeAwarenessUpdate')
				.mockReturnValue(new Uint8Array([1, 2, 3, 4]));
			const clients = [1, 2, 3];

			return { awareness, encodeSpy, clients };
		};

		it('should call encodeSpy', () => {
			const { awareness, clients, encodeSpy } = setup();

			encodeAwarenessUpdate(awareness, clients);

			expect(encodeSpy).toHaveBeenCalledWith(awareness, clients);
		});

		it('should return the encoded awareness update message', () => {
			const { awareness, clients } = setup();

			const result = encodeAwarenessUpdate(awareness, clients);

			expect(result).toEqual(new Uint8Array([1, 4, 1, 2, 3, 4]));
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
