import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsNumber, IsString, IsUrl } from 'class-validator';
import { RedisConfig } from '../../infra/redis/redis.config.js';

export class ServerConfig extends RedisConfig {
	@IsString()
	public WS_PATH_PREFIX = '';

	@IsNumber()
	@Transform(({ value }) => parseInt(value))
	public WS_PORT = 3345;

	@IsUrl({ protocols: ['wss', 'ws'], require_tld: false })
	public TLDRAW__WEBSOCKET_URL!: string;

	@Transform(({ value }) => value === 'true')
	@IsBoolean()
	public TLDRAW__ASSETS_ENABLED = true;

	@Transform(({ value }) => parseInt(value))
	@IsNumber()
	public TLDRAW__ASSETS_MAX_SIZE_BYTES = 10485760;

	@Transform(({ value }) => value.split(','))
	@IsArray()
	public TLDRAW__ASSETS_ALLOWED_MIME_TYPES_LIST = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml'];

	@Transform(({ value }) => value === 'true')
	@IsBoolean()
	public FEATURE_TLDRAW_ENABLED!: boolean;
}
