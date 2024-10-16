import { IsString, IsUrl, ValidateIf } from 'class-validator';

export class RedisConfig {
	@IsUrl({ protocols: ['redis'], require_tld: false })
	@ValidateIf((o: RedisConfig) => o.REDIS_SENTINEL_SERVICE_NAME === undefined)
	public REDIS!: string;

	@IsString()
	@ValidateIf((o: RedisConfig) => o.REDIS === undefined)
	public REDIS_SENTINEL_SERVICE_NAME!: string;

	@IsString()
	public REDIS_PREFIX = 'y';

	@IsString()
	public REDIS_SENTINEL_NAME = 'mymaster';

	@IsString()
	@ValidateIf((o: RedisConfig) => o.REDIS_SENTINEL_SERVICE_NAME !== undefined)
	public REDIS_SENTINEL_PASSWORD!: string;
}
