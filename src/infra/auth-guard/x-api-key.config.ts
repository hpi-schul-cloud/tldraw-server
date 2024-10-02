import { Transform } from 'class-transformer';
import { IsArray } from 'class-validator';

export class XApiKeyConfig {
	@Transform(({ value }) => value.split(',').map((part: string) => (part.split(':').pop() ?? '').trim()))
	@IsArray()
	public ADMIN_API__ALLOWED_API_KEYS!: string[];
}
