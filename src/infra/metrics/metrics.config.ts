import { IsBoolean } from 'class-validator';
import { StringToBoolean } from '../../shared/transformer/index.js';
import { ConfigProperty, Configuration } from '../configuration/index.js';

export const METRICS_CONFIG = 'METRICS_CONFIG';
@Configuration()
export class MetricConfig {
	@IsBoolean()
	@StringToBoolean()
	@ConfigProperty('METRICS_COLLECT_DEFAULT')
	public metricsCollectDefault = true;
}
