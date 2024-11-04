import { Factory } from 'fishery';
import { StreamsMessagesReply } from 'infra/redis/interfaces/stream-message-reply.js';

export const streamsMessagesReplyFactory = Factory.define<StreamsMessagesReply>(({ sequence }) => {
	return [
		{
			name: `prefix:room:roomid:docid`,
			messages: [
				{
					id: `1-2`,
					message: {
						key: `redis-key-${sequence}-1`,
						m: `message-${sequence}-2`,
						docName: `doc-name-${sequence}`,
						compact: `compact-${sequence}`,
					},
				},
				{
					id: `2-3`,
					message: {
						key: `redis-key-${sequence}-2`,
						m: `message-${sequence}-2`,
						docName: `doc-name-${sequence}`,
						compact: `compact-${sequence}`,
					},
				},
			],
		},
	];
});
