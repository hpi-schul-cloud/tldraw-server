import { Transform } from 'class-transformer';
import { IsNumber, IsPositive } from 'class-validator';

export class WorkerConfig {
	/**
	 * After this timeout, a worker will pick up a task and clean up a stream.
	 */
	@IsNumber()
	@Transform(({ value }) => parseInt(value))
	public WORKER_TASK_DEBOUNCE = 10000;

	/**
	 * Minimum lifetime of y* update messages in redis streams.
	 */
	@IsNumber()
	@IsPositive()
	@Transform(({ value }) => parseInt(value))
	public WORKER_MIN_MESSAGE_LIFETIME = 60000;

	@IsNumber()
	@Transform(({ value }) => parseInt(value))
	public WORKER_TRY_CLAIM_COUNT = 5;

	@IsNumber()
	@IsPositive()
	@Transform(({ value }) => parseInt(value))
	public WORKER_IDLE_BREAK_MS = 1000;
}
