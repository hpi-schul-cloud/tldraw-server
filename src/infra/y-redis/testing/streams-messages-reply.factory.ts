import { Factory } from 'fishery';
import { StreamsMessagesReply } from 'infra/redis/interfaces/stream-message-reply.js';
import { streamMessageReplyFactory } from './stream-message-reply.factory.js';

export const streamsMessagesReplyFactory = Factory.define<StreamsMessagesReply>(({ sequence }) => {
	return [
		{
			name: `prefix:room:roomid-${sequence}:docid`,
			messages: [streamMessageReplyFactory.build(), streamMessageReplyFactory.build()],
		},
	];
});
