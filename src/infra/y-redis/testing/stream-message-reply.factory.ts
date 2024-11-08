import { Factory } from 'fishery';
import { StreamMessageReply } from '../../../infra/redis/interfaces/stream-message-reply.js';

export const streamMessageReplyFactory = Factory.define<StreamMessageReply>(({ sequence }) => {
	return {
		id: `redis-id-${sequence}`,
		message: {
			key: `redis-key-${sequence}-1`,
			m: `message-${sequence}-2`,
			docName: `doc-name-${sequence}`,
			compact: `compact-${sequence}`,
		},
	};
});
