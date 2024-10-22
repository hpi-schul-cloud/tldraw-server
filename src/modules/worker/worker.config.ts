import { Transform } from 'class-transformer';
import { IsNumber } from 'class-validator';
import { RedisConfig } from '../../infra/redis/redis.config.js';

export class WorkerConfig extends RedisConfig {
	@IsNumber()
	@Transform(({ value }) => parseInt(value))
	public WORKER_TASK_DEBOUNCE = 10000;

	@IsNumber()
	@Transform(({ value }) => parseInt(value))
	public WORKER_MIN_MESSAGE_LIFETIME = 60000;

	@IsNumber()
	@Transform(({ value }) => parseInt(value))
	public WORKER_TRY_CLAIM_COUNT = 5;
}
