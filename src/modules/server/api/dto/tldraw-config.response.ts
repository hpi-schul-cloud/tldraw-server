import { ApiProperty } from '@nestjs/swagger';
import { ServerConfig } from '../../server.config.js';

export class TldrawPublicConfigResponse {
	public constructor(config: ServerConfig) {
		this.TLDRAW_WEBSOCKET_URL = config.SERVER_WEBSOCKET_URL;
		this.TLDRAW_ASSETS_ENABLED = config.SERVER_ASSETS_ENABLED;
		this.TLDRAW_ASSETS_MAX_SIZE_BYTES = config.SERVER_ASSETS_MAX_SIZE_BYTES;
		this.TLDRAW_ASSETS_ALLOWED_MIME_TYPES_LIST = config.SERVER_ASSETS_ALLOWED_MIME_TYPES_LIST;
		this.FEATURE_TLDRAW_ENABLED = config.SERVER_FEATURE_TLDRAW_ENABLED;
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
}
