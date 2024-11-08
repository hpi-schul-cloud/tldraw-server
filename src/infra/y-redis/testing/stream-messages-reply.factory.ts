import { Factory } from 'fishery';
import { StreamMessagesReply } from '../../../infra/redis/interfaces/index.js';
import { streamMessageReplyFactory } from './stream-message-reply.factory.js';

export const streamMessagesReplyFactory = Factory.define<StreamMessagesReply>(({ sequence }) => {
	return [
		{
			name: `prefix:room:roomid-${sequence}:docid`,
			messages: [streamMessageReplyFactory.build(), streamMessageReplyFactory.build()],
		},
	];
});
