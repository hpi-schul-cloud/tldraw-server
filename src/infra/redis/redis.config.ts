import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUrl, ValidateIf } from 'class-validator';

export class RedisConfig {
	@IsBoolean()
	@IsOptional()
	@Transform(({ value }) => value === 'true')
	public REDIS_CLUSTER_ENABLED!: boolean;

	@IsUrl({ protocols: ['redis'], require_tld: false })
	@ValidateIf((o: RedisConfig) => o.REDIS_CLUSTER_ENABLED === false)
	public REDIS!: string;

	@IsString()
	@ValidateIf((o: RedisConfig) => o.REDIS_CLUSTER_ENABLED === true)
	public REDIS_SENTINEL_SERVICE_NAME!: string;

	@IsString()
	public REDIS_PREFIX = 'y';

	@IsString()
	public REDIS_SENTINEL_NAME = 'mymaster';

	@IsString()
	@ValidateIf((o: RedisConfig) => o.REDIS_CLUSTER_ENABLED === true)
	public REDIS_SENTINEL_PASSWORD!: string;
}
