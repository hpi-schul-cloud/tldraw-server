
import { RedisMemoryServer } from 'redis-memory-server';
import { Client } from 'minio';

export default async function globalSetup(): Promise<void> {
	const redisMemoryServer = new RedisMemoryServer();

	const host = await redisMemoryServer.getHost();
	const port = await redisMemoryServer.getPort();
	process.env.REDIS_URL = `redis://${host}:${port}`;
	// @ts-ignore
	global.__REDISINSTANCE = redisMemoryServer;

	const minioClient = new Client({
		endPoint: 'localhost',
		port: 9000,
		useSSL: false,
		accessKey: 'miniouser',
		secretKey: 'miniouser',
	});

	const bucketName = 'test-bucket';
	process.env.S3_BUCKET = bucketName;

	const bucketExists = await minioClient.bucketExists(bucketName);
	if (!bucketExists) {
		await minioClient.makeBucket(bucketName);
	}
}

