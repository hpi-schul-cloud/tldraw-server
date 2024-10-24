import { RedisKey } from 'ioredis';

export interface StreamNameClockPair {
	key: RedisKey;
	id: string;
}
