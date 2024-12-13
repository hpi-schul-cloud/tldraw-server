import { Factory } from 'fishery';
import { StreamMessageReply, XAutoClaimResponse } from '../interfaces/index.js';

export const xAutoClaimResponseFactory = Factory.define<XAutoClaimResponse>(({ sequence }) => {
	return {
		nextId: sequence.toString(),
		messages: [],
	};
});

export const streamMessageReplyFactory = Factory.define<StreamMessageReply>(({ sequence }) => {
	return {
		id: sequence.toString(),
		message: {
			key: sequence.toString(),
			m: Buffer.from(sequence.toString()),
			docName: `prefix:room:room:docid-${sequence.toString()}`,
			compact: Buffer.from(`prefix:room:room:docid-${sequence.toString()}`),
		},
	};
});
