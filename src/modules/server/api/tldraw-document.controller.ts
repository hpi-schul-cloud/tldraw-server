import { Controller, Delete, HttpCode, Param, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../../../infra/auth-guard/guard/index.js';
import { TldrawDocumentService } from '../service/tldraw-document.service.js';
import { TldrawDocumentDeleteParams } from './dto/index.js';

@UseGuards(ApiKeyGuard)
@Controller('tldraw-document')
export class TldrawDocumentController {
	public constructor(private readonly tldrawDocumentService: TldrawDocumentService) {}

	@HttpCode(204)
	@Delete(':parentId')
	public async deleteByDocName(@Param() urlParams: TldrawDocumentDeleteParams): Promise<void> {
		await this.tldrawDocumentService.deleteByDocName(urlParams.parentId);
	}
}
