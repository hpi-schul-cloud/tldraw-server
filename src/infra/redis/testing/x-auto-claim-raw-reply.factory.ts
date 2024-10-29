import { Factory } from 'fishery';
import { XAutoClaimRawReply } from '../interfaces/redis.interface.js';
import { xItemsBufferFactory, xItemsStringFactory } from './x-items.factory.js';

export const xAutoClaimRawReply = Factory.define<XAutoClaimRawReply>(({ sequence }) => [
	sequence.toString(),
	xItemsStringFactory.build(),
]);

export const xAutoClaimBufferRawReply = Factory.define<XAutoClaimRawReply>(({ sequence }) => [
	Buffer.from(sequence.toString()),
	xItemsBufferFactory.build(),
]);
