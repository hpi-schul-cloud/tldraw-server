import { ApiProperty } from '@nestjs/swagger';
import { TldrawServerConfig } from '../../tldraw-server.config.js';

export class TldrawPublicConfigResponse {
	public constructor(config: TldrawServerConfig) {
		this.TLDRAW_WEBSOCKET_URL = config.TLDRAW_WEBSOCKET_URL;
		this.TLDRAW_ASSETS_ENABLED = config.TLDRAW_ASSETS_ENABLED;
		this.TLDRAW_ASSETS_MAX_SIZE_BYTES = config.TLDRAW_ASSETS_MAX_SIZE_BYTES;
		this.TLDRAW_ASSETS_ALLOWED_MIME_TYPES_LIST = config.TLDRAW_ASSETS_ALLOWED_MIME_TYPES_LIST;
		this.FEATURE_TLDRAW_ENABLED = config.FEATURE_TLDRAW_ENABLED;
		this.NOT_AUTHENTICATED_REDIRECT_URL = config.NOT_AUTHENTICATED_REDIRECT_URL;
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
