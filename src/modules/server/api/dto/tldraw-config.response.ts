import { ApiProperty } from '@nestjs/swagger';

export class TldrawPublicConfigResponse {
	public constructor(config: TldrawPublicConfigResponse) {
		this.TLDRAW__WEBSOCKET_URL = config.TLDRAW__WEBSOCKET_URL;
		this.TLDRAW__ASSETS_ENABLED = config.TLDRAW__ASSETS_ENABLED;
		this.TLDRAW__ASSETS_MAX_SIZE_BYTES = config.TLDRAW__ASSETS_MAX_SIZE_BYTES;
		this.TLDRAW__ASSETS_ALLOWED_MIME_TYPES_LIST = config.TLDRAW__ASSETS_ALLOWED_MIME_TYPES_LIST;
		this.FEATURE_TLDRAW_ENABLED = config.FEATURE_TLDRAW_ENABLED;
	}

	@ApiProperty()
	public TLDRAW__WEBSOCKET_URL: string;

	@ApiProperty()
	public TLDRAW__ASSETS_ENABLED: boolean;

	@ApiProperty()
	public TLDRAW__ASSETS_MAX_SIZE_BYTES: number;

	@ApiProperty()
	public TLDRAW__ASSETS_ALLOWED_MIME_TYPES_LIST: string[];

	@ApiProperty()
	public FEATURE_TLDRAW_ENABLED!: boolean;
}
