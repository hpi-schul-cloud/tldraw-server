import { IsString } from 'class-validator';

export class StorageConfig {
	@IsString()
	public S3_ENDPOINT!: string;

	@IsString()
	public S3_BUCKET = 'ydocs';
}
