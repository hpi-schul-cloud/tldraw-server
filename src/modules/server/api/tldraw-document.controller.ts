import { Controller, Delete, HttpCode, Param, UseGuards } from '@nestjs/common';
import { TldrawDocumentDeleteParams } from './dto/index.js';
import { ApiKeyGuard } from '../../../infra/auth-guard/guard/index.js';

@UseGuards(ApiKeyGuard)
@Controller('tldraw-document')
export class TldrawDocumentController {
	@HttpCode(204)
	@Delete(':docName')
	async deleteByDocName(@Param() urlParams: TldrawDocumentDeleteParams) {
		console.log('deleteByDocName', urlParams);
	}
}
