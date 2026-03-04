import { IsNumber, IsPositive } from 'class-validator';
import { ConfigProperty, Configuration } from '../../infra/configuration/index.js';
import { StringToNumber } from '../../shared/transformer/index.js';

export const WORKER_CONFIG = 'WORKER_CONFIG';
@Configuration()
export class WorkerConfig {
	/**
	 * After this timeout, a worker will pick up a task and clean up a stream.
	 */
	@IsNumber()
	@StringToNumber()
	@ConfigProperty()
	public WORKER_TASK_DEBOUNCE = 10000;

	/**
	 * Minimum lifetime of y* update messages in redis streams.
	 */
	@IsNumber()
	@IsPositive()
	@StringToNumber()
	@ConfigProperty()
	public WORKER_MIN_MESSAGE_LIFETIME = 60000;

	@IsNumber()
	@StringToNumber()
	@ConfigProperty()
	public WORKER_TRY_CLAIM_COUNT = 5;

	@IsNumber()
	@IsPositive()
	@StringToNumber()
	@ConfigProperty()
	public WORKER_IDLE_BREAK_MS = 1000;
}
