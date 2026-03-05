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
	@ConfigProperty('WORKER_TASK_DEBOUNCE')
	public workerTaskDebounce = 10000;

	/**
	 * Minimum lifetime of y* update messages in redis streams.
	 */
	@IsNumber()
	@IsPositive()
	@StringToNumber()
	@ConfigProperty('WORKER_MIN_MESSAGE_LIFETIME')
	public workerMinMessageLifetime = 60000;

	@IsNumber()
	@StringToNumber()
	@ConfigProperty('WORKER_TRY_CLAIM_COUNT')
	public workerTryClaimCount = 5;

	@IsNumber()
	@IsPositive()
	@StringToNumber()
	@ConfigProperty('WORKER_IDLE_BREAK_MS')
	public workerIdleBreakMs = 1000;
}
