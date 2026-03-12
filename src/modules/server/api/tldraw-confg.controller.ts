import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TLDRAW_SERVER_CONFIG, TldrawServerConfig } from '../tldraw-server.config.js';
import { TldrawPublicConfigResponse } from './dto/tldraw-config.response.js';

@ApiTags('tldraw/config')
@Controller('tldraw/config')
export class TldrawConfigController {
	public constructor(@Inject(TLDRAW_SERVER_CONFIG) private readonly config: TldrawServerConfig) {}

	@ApiOperation({ summary: 'Useable configuration for clients' })
	@ApiResponse({ status: 200, type: TldrawPublicConfigResponse })
	@Get('/public')
	public publicConfig(): TldrawPublicConfigResponse {
		const response = new TldrawPublicConfigResponse(this.config);

		return response;
	}
}
