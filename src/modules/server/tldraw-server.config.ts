import { IsArray, IsBoolean, IsNumber, IsString, IsUrl } from 'class-validator';
import { ConfigProperty, Configuration } from '../../infra/configuration/index.js';
import { CommaSeparatedStringToArray, StringToBoolean, StringToNumber } from '../../shared/transformer/index.js';

export const TLDRAW_SERVER_CONFIG = 'TLDRAW_SERVER_CONFIG';
@Configuration()
export class TldrawServerConfig {
	@IsString()
	@ConfigProperty()
	public TLDRAW_WEBSOCKET_PATH = '';

	@IsNumber()
	@StringToNumber()
	@ConfigProperty()
	public TLDRAW_WEBSOCKET_PORT = 3345;

	@IsUrl({ protocols: ['wss', 'ws'], require_tld: false })
	@ConfigProperty()
	public TLDRAW_WEBSOCKET_URL!: string;

	@StringToBoolean()
	@IsBoolean()
	@ConfigProperty()
	public TLDRAW_ASSETS_ENABLED = true;

	@StringToNumber()
	@IsNumber()
	@ConfigProperty()
	public TLDRAW_ASSETS_MAX_SIZE_BYTES = 10485760;

	@CommaSeparatedStringToArray()
	@IsArray()
	@ConfigProperty()
	public TLDRAW_ASSETS_ALLOWED_MIME_TYPES_LIST = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml'];

	@StringToBoolean()
	@IsBoolean()
	@ConfigProperty()
	public FEATURE_TLDRAW_ENABLED!: boolean;

	@IsUrl({ protocols: ['https', 'http'], require_tld: false })
	@ConfigProperty()
	public NOT_AUTHENTICATED_REDIRECT_URL!: string;
}
