import { Factory } from 'fishery';
import { XReadBufferReply } from '../interfaces/redis.interface.js';
import { xItemsBufferFactory } from './x-items.factory.js';

export const xReadBufferReply = Factory.define<XReadBufferReply>(({ sequence }) => [
	[Buffer.from(sequence.toString()), xItemsBufferFactory.build()],
]);