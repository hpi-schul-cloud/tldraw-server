import { Factory } from 'fishery';
import { XAutoClaimRawReply } from '../interfaces/index.js';
import { xItemsBufferFactory, xItemsStringFactory } from './x-items.factory.js';

export const xAutoClaimRawReplyFactory = Factory.define<XAutoClaimRawReply>(({ sequence }) => [
	sequence.toString(),
	xItemsStringFactory.build(),
]);

export const xAutoClaimBufferRawReplyFactory = Factory.define<XAutoClaimRawReply>(({ sequence }) => [
	Buffer.from(sequence.toString()),
	xItemsBufferFactory.build(),
]);
