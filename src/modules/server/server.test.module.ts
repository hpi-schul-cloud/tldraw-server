import { Module } from '@nestjs/common';
import { InMemoryRedisTestModule } from '../../infra/redis/in-memory-redis-test.module.js';
import { moduleControllers, moduleImports, moduleProviders } from './server.module.js';

@Module({
	imports: [InMemoryRedisTestModule, ...moduleImports],
	providers: moduleProviders,
	controllers: moduleControllers,
})
export class ServerTestModule {}
