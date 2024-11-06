import { Factory } from 'fishery';
import { XReadBufferReply } from '../interfaces/redis.js';
import { xItemsBufferFactory } from './x-items.factory.js';

export const xReadBufferReplyFactory = Factory.define<XReadBufferReply>(({ sequence }) => [
	[Buffer.from(sequence.toString()), xItemsBufferFactory.build()],
]);
