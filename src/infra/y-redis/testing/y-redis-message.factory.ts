import { Factory } from 'fishery';
import { YRedisMessage } from '../interfaces/stream-message.js';

export const yRedisMessageFactory = Factory.define<YRedisMessage>(({ sequence }) => {
	return {
		stream: `prefix:room:roomid:docid`,
		messages: [Buffer.from(`message-${sequence}`)],
		lastId: `last-id-${sequence}`,
	};
});
