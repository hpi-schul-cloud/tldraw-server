import { Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RedisMemoryServer } from 'redis-memory-server';

@Module({})
export class InMemoryRedisTestModule implements OnModuleInit, OnModuleDestroy {
	private redisMemoryServer!: RedisMemoryServer;

	public async onModuleInit(): Promise<void> {
		this.redisMemoryServer = new RedisMemoryServer({
			instance: {
				port: 6379,
			},
			autoStart: false,
		});

		await this.redisMemoryServer.start();
	}

	public async onModuleDestroy(): Promise<void> {
		await this.redisMemoryServer.stop();
	}
}
