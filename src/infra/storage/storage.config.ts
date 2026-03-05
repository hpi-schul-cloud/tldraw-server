import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsString } from 'class-validator';
import { StringToBoolean } from '../../shared/transformer/index.js';
import { ConfigProperty, Configuration } from '../configuration/index.js';

export const STORAGE_CONFIG = 'STORAGE_CONFIG';
@Configuration()
export class StorageConfig {
	@IsString()
	@ConfigProperty('S3_ENDPOINT')
	public s3Endpoint!: string;

	@IsString()
	@ConfigProperty('S3_BUCKET')
	public s3Bucket!: string;

	@IsNumber()
	@Type(() => Number)
	@ConfigProperty('S3_PORT')
	public s3Port!: number;

	@IsBoolean()
	@StringToBoolean()
	@ConfigProperty('S3_SSL')
	public s3Ssl!: boolean;

	@IsString()
	@ConfigProperty('S3_ACCESS_KEY')
	public s3AccessKey!: string;

	@IsString()
	@ConfigProperty('S3_SECRET_KEY')
	public s3SecretKey!: string;
}
