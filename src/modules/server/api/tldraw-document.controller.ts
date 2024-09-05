import { Controller, Delete, HttpCode, Param, UseGuards } from '@nestjs/common';
import { TldrawDocumentDeleteParams } from './dto/index.js';
import { ApiKeyGuard } from '../../../infra/auth-guard/guard/index.js';
import { TldrawDocumentService } from '../service/tldraw-document.service.js';

@UseGuards(ApiKeyGuard)
@Controller('tldraw-document')
export class TldrawDocumentController {
	constructor(private readonly tldrawDocumentService: TldrawDocumentService) {}

	@HttpCode(204)
	@Delete(':parentId')
	async deleteByDocName(@Param() urlParams: TldrawDocumentDeleteParams) {
		this.tldrawDocumentService.deleteByDocName(urlParams.parentId);
	}
}
