import { Factory } from 'fishery';
import { XAutoClaimResponse } from '../interfaces/redis.interface.js';
import { StreamMessageReply } from '../interfaces/stream-message-reply.js';

export const xAutoClaimResponse = Factory.define<XAutoClaimResponse>(({ sequence }) => {
	return {
		nextId: sequence.toString(),
		messages: [],
	};
});

export const streamMessageReply = Factory.define<StreamMessageReply>(({ sequence }) => {
	return {
		id: sequence.toString(),
		message: {
			key: sequence.toString(),
			m: sequence.toString(),
			docName: `prefix:room:room:docid-${sequence.toString()}`,
			compact: `prefix:room:room:docid-${sequence.toString()}`,
		},
	};
});
