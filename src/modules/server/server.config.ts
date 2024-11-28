import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsNumber, IsString, IsUrl } from 'class-validator';

export class ServerConfig {
	@IsString()
	public SERVER_WEBSOCKET_PATH = '';

	@IsNumber()
	@Transform(({ value }) => parseInt(value))
	public SERVER_WEBSOCKET_PORT = 3345;

	@IsUrl({ protocols: ['wss', 'ws'], require_tld: false })
	public SERVER_WEBSOCKET_URL!: string;

	@Transform(({ value }) => value === 'true')
	@IsBoolean()
	public SERVER_ASSETS_ENABLED = true;

	@Transform(({ value }) => parseInt(value))
	@IsNumber()
	public SERVER_ASSETS_MAX_SIZE_BYTES = 10485760;

	@Transform(({ value }) => value.split(','))
	@IsArray()
	public SERVER_ASSETS_ALLOWED_MIME_TYPES_LIST = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml'];

	@Transform(({ value }) => value === 'true')
	@IsBoolean()
	public SERVER_FEATURE_TLDRAW_ENABLED!: boolean;
}
