import { YRedisUser } from './y-redis-user.js';

interface YRedisUserProps {
	room: string | null;
	hasWriteAccess: boolean;
	userid: string | null;
	error: Partial<CloseEvent> | null;
}

export class YRedisUserFactory {
	public static build(props: YRedisUserProps): YRedisUser {
		const user = new YRedisUser(props.room, props.hasWriteAccess, props.userid, props.error);

		return user;
	}
}
