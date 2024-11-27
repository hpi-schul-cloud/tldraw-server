import { RedisMemoryServer } from 'redis-memory-server';

export default async function globalTeardown(): Promise<void> {
	// @ts-ignore
	const instance: RedisMemoryServer = global.__REDISINSTANCE;
	await instance.stop();
}
