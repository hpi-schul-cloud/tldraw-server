import { Factory } from 'fishery';
import { YRedisUser } from '../y-redis-user.js';

export const yRedisUserFactory = Factory.define<YRedisUser>(({ sequence }) => {
	const error = null;

	return {
		initialRedisSubId: '0',
		room: `room-${sequence}`,
		hasWriteAccess: false,
		userid: `userid-${sequence}`,
		error,
		subs: new Set(),
		id: sequence,
		awarenessId: sequence,
		awarenessLastClock: 0,
		awarenessLastUpdated: new Date(),
		isClosed: false,
		hasError: (): boolean => error !== null,
	};
});
