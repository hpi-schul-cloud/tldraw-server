import { IsArray, IsBoolean, IsNumber, IsString, IsUrl } from 'class-validator';
import { ConfigProperty, Configuration } from '../../infra/configuration/index.js';
import { CommaSeparatedStringToArray, StringToBoolean, StringToNumber } from '../../shared/transformer/index.js';

export const TLDRAW_SERVER_CONFIG = 'TLDRAW_SERVER_CONFIG';
@Configuration()
export class TldrawServerConfig {
	@IsString()
	@ConfigProperty('TLDRAW_WEBSOCKET_PATH')
	public tldrawWebsocketPath = '';

	@IsNumber()
	@StringToNumber()
	@ConfigProperty('TLDRAW_WEBSOCKET_PORT')
	public tldrawWebsocketPort = 3345;

	@IsUrl({ protocols: ['wss', 'ws'], require_tld: false })
	@ConfigProperty('TLDRAW_WEBSOCKET_URL')
	public tldrawWebsocketUrl!: string;

	@StringToBoolean()
	@IsBoolean()
	@ConfigProperty('TLDRAW_ASSETS_ENABLED')
	public tldrawAssetsEnabled = true;

	@StringToNumber()
	@IsNumber()
	@ConfigProperty('TLDRAW_ASSETS_MAX_SIZE_BYTES')
	public tldrawAssetsMaxSizeBytes = 10485760;

	@CommaSeparatedStringToArray()
	@IsArray()
	@ConfigProperty('TLDRAW_ASSETS_ALLOWED_MIME_TYPES_LIST')
	public tldrawAssetsAllowedMimeTypesList = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml'];

	@StringToBoolean()
	@IsBoolean()
	@ConfigProperty('FEATURE_TLDRAW_ENABLED')
	public featureTldrawEnabled!: boolean;

	@IsUrl({ protocols: ['https', 'http'], require_tld: false })
	@ConfigProperty('NOT_AUTHENTICATED_REDIRECT_URL')
	public notAuthenticatedRedirectUrl!: string;
}
