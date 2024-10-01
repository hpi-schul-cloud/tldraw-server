import { IsOptional, IsString } from 'class-validator';

export class StorageConfig {
	@IsString()
	@IsOptional()
	public S3_ENDPOINT!: string;

	@IsString()
	public S3_BUCKET = 'ydocs';
}
