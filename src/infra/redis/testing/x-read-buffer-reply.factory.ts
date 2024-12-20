import { Factory } from 'fishery';
import { XReadBufferReply } from '../interfaces/index.js';
import { xItemsBufferFactory } from './x-items.factory.js';

export const xReadBufferReplyFactory = Factory.define<XReadBufferReply>(({ sequence }) => [
	[Buffer.from(sequence.toString()), xItemsBufferFactory.build()],
]);
