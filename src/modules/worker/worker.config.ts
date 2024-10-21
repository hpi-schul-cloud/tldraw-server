import { Transform } from 'class-transformer';
import { IsNumber } from 'class-validator';
import { RedisConfig } from '../../infra/redis/redis.config.js';

export class WorkerConfig extends RedisConfig {
	@IsNumber()
	@Transform(({ value }) => parseInt(value))
	public REDIS_TASK_DEBOUNCE = 10000;

	@IsNumber()
	@Transform(({ value }) => parseInt(value))
	public REDIS_MIN_MESSAGE_LIFETIME = 60000;
}
