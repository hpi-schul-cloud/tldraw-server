import { Factory } from 'fishery';
import { StreamMessageReply } from '../interfaces/index.js';

export const streamMessageReplyFactory = Factory.define<StreamMessageReply>(({ sequence }) => {
	return {
		id: `redis-id-${sequence}`,
		message: {
			m: Buffer.from(`message-${sequence}-2`),
			docName: `prefix:room:room:docid-${sequence.toString()}`,
			compact: Buffer.from(`prefix:room:room:docid-${sequence.toString()}`),
		},
	};
});
