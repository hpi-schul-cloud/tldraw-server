import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class MetricConfig {
	@IsBoolean()
	@Transform(({ value }) => value === 'true')
	public METRICS_COLLECT_DEFAULT = true;
}
