import { Factory } from 'fishery';
import { XItem } from '../interfaces/redis.js';

export const xItemStringFactory = Factory.define<XItem>(({ sequence }) => [sequence.toString(), ['key', 'message']]);

export const xItemBufferFactory = Factory.define<XItem>(({ sequence }) => [
	Buffer.from(sequence.toString()),
	[Buffer.from('message'), Buffer.from('value')],
]);
