import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TldrawPublicConfigResponse } from './dto/tldraw-config.response.js';

@ApiTags('tldraw/config')
@Controller('tldraw/config')
export class TldrawConfigController {
	public constructor(private readonly configService: ConfigService) {}

	@ApiOperation({ summary: 'Useable configuration for clients' })
	@ApiResponse({ status: 200, type: TldrawPublicConfigResponse })
	@Get('/public')
	public publicConfig(): TldrawPublicConfigResponse {
		const mappedConfig = {
			TLDRAW__WEBSOCKET_URL: this.configService.getOrThrow('TLDRAW__WEBSOCKET_URL'),
			TLDRAW__ASSETS_ENABLED: this.configService.getOrThrow('TLDRAW__ASSETS_ENABLED') === 'true',
			TLDRAW__ASSETS_MAX_SIZE_BYTES: parseInt(this.configService.getOrThrow('TLDRAW__ASSETS_MAX_SIZE_BYTES')),
			TLDRAW__ASSETS_ALLOWED_MIME_TYPES_LIST: this.configService
				.getOrThrow('TLDRAW__ASSETS_ALLOWED_MIME_TYPES_LIST')
				.split(','),
			FEATURE_TLDRAW_ENABLED: this.configService.getOrThrow('FEATURE_TLDRAW_ENABLED') === 'true',
		};

		const response = new TldrawPublicConfigResponse(mappedConfig);

		return response;
	}
}
