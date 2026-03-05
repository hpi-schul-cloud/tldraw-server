import { ApiProperty } from '@nestjs/swagger';
import { TldrawServerConfig } from '../../tldraw-server.config.js';

export class TldrawPublicConfigResponse {
	public constructor(config: TldrawServerConfig) {
		this.TLDRAW_WEBSOCKET_URL = config.tldrawWebsocketUrl;
		this.TLDRAW_ASSETS_ENABLED = config.tldrawAssetsEnabled;
		this.TLDRAW_ASSETS_MAX_SIZE_BYTES = config.tldrawAssetsMaxSizeBytes;
		this.TLDRAW_ASSETS_ALLOWED_MIME_TYPES_LIST = config.tldrawAssetsAllowedMimeTypesList;
		this.FEATURE_TLDRAW_ENABLED = config.featureTldrawEnabled;
		this.NOT_AUTHENTICATED_REDIRECT_URL = config.notAuthenticatedRedirectUrl;
	}

	@ApiProperty()
	public TLDRAW_WEBSOCKET_URL: string;

	@ApiProperty()
	public TLDRAW_ASSETS_ENABLED: boolean;

	@ApiProperty()
	public TLDRAW_ASSETS_MAX_SIZE_BYTES: number;

	@ApiProperty()
	public TLDRAW_ASSETS_ALLOWED_MIME_TYPES_LIST: string[];

	@ApiProperty()
	public FEATURE_TLDRAW_ENABLED!: boolean;

	@ApiProperty()
	public NOT_AUTHENTICATED_REDIRECT_URL: string;
}
