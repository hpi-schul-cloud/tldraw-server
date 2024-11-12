import { RedisMemoryServer } from 'redis-memory-server';

export default async function globalSetup(): Promise<void> {
	const redisMemoryServer = new RedisMemoryServer();

	const host = await redisMemoryServer.getHost();
	const port = await redisMemoryServer.getPort();
	process.env.REDIS = `redis://${host}:${port}`;
	// @ts-ignore
	global.__REDISINSTANCE = redisMemoryServer;
}
