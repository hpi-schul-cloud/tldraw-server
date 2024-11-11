import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class TldrawDocumentDeleteParams {
	@IsMongoId()
	@ApiProperty()
	public parentId!: string;
}
