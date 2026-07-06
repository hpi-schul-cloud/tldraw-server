import { Factory } from 'fishery';
import { XAutoClaimRawReply } from '../interfaces/index.js';
import { xItemsStringFactory } from './x-items.factory.js';

export const xAutoClaimRawReplyFactory = Factory.define<XAutoClaimRawReply>(({ sequence }) => [
	sequence.toString(),
	xItemsStringFactory.build(),
]);
