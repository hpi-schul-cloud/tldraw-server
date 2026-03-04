import { IsBoolean, IsOptional, IsString, IsUrl, ValidateIf } from 'class-validator';
import { StringToBoolean } from '../../shared/transformer/index.js';
import { ConfigProperty, Configuration } from '../configuration/index.js';

export const REDIS_CONFIG = 'REDIS_CONFIG';
@Configuration()
export class RedisConfig {
	@IsBoolean()
	@IsOptional()
	@StringToBoolean()
	@ConfigProperty()
	public REDIS_CLUSTER_ENABLED!: boolean;

	@IsUrl({ protocols: ['redis'], require_tld: false })
	@ValidateIf((o: RedisConfig) => !o.REDIS_CLUSTER_ENABLED)
	@ConfigProperty()
	public REDIS_URL!: string;

	@IsString()
	@ValidateIf((o: RedisConfig) => o.REDIS_CLUSTER_ENABLED)
	@ConfigProperty()
	public REDIS_SENTINEL_SERVICE_NAME!: string;

	@IsString()
	@ConfigProperty()
	public REDIS_PREFIX = 'y';

	@IsString()
	@ConfigProperty()
	public REDIS_SENTINEL_NAME = 'myprimary';

	@IsString()
	@ValidateIf((o: RedisConfig) => o.REDIS_CLUSTER_ENABLED)
	@ConfigProperty()
	public REDIS_SENTINEL_PASSWORD!: string;
}
