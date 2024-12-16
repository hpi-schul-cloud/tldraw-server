import { Factory } from 'fishery';
import { XAutoClaimResponse } from '../interfaces/index.js';

export const xAutoClaimResponseFactory = Factory.define<XAutoClaimResponse>(({ sequence }) => {
	return {
		nextId: sequence.toString(),
		messages: [],
	};
});
