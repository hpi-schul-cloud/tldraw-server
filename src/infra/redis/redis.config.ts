import { IsOptional, IsString, IsUrl } from 'class-validator';

export class RedisConfig {
	@IsUrl({ protocols: ['redis'], require_tld: false })
	@IsOptional()
	public REDIS!: string;

	@IsString()
	@IsOptional()
	public REDIS_SENTINEL_SERVICE_NAME!: string;

	@IsString()
	public REDIS_PREFIX = 'y';

	@IsString()
	public REDIS_SENTINEL_NAME = 'mymaster';

	@IsString()
	@IsOptional()
	public REDIS_SENTINEL_PASSWORD!: string;
}
