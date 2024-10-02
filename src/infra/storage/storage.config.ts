import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsString } from 'class-validator';

export class StorageConfig {
	@IsString()
	public S3_ENDPOINT!: string;

	@IsString()
	public S3_BUCKET = 'ydocs';

	@IsNumber()
	@Type(() => Number)
	public S3_PORT!: number;

	@IsBoolean()
	@Transform(({ value }: { value: string }) => {
		if (value.toLowerCase() === 'true') {
			return true;
		} else {
			return false;
		}
	})
	public S3_SSL!: boolean;

	@IsString()
	public S3_ACCESS_KEY!: string;

	@IsString()
	public S3_SECRET_KEY!: string;
}
