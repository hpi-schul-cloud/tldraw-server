import { IsBoolean, IsOptional, IsString, IsUrl, ValidateIf } from 'class-validator';
import { StringToBoolean } from '../../shared/transformer/index.js';
import { ConfigProperty, Configuration } from '../configuration/index.js';

export const REDIS_CONFIG = 'REDIS_CONFIG';
@Configuration()
export class RedisConfig {
	@IsBoolean()
	@IsOptional()
	@StringToBoolean()
	@ConfigProperty('REDIS_CLUSTER_ENABLED')
	public redisClusterEnabled!: boolean;

	@IsUrl({ protocols: ['redis'], require_tld: false })
	@ValidateIf((o: RedisConfig) => !o.redisClusterEnabled)
	@ConfigProperty('REDIS_URL')
	public redisUrl!: string;

	@IsString()
	@ValidateIf((o: RedisConfig) => o.redisClusterEnabled)
	@ConfigProperty('REDIS_SENTINEL_SERVICE_NAME')
	public redisSentinelServiceName!: string;

	@IsString()
	@ConfigProperty('REDIS_PREFIX')
	public redisPrefix = 'y';

	@IsString()
	@ConfigProperty('REDIS_SENTINEL_NAME')
	public redisSentinelName = 'myprimary';

	@IsString()
	@ValidateIf((o: RedisConfig) => o.redisClusterEnabled)
	@ConfigProperty('REDIS_SENTINEL_PASSWORD')
	public redisSentinelPassword!: string;
}
