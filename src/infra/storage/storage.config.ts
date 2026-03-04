import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsString } from 'class-validator';
import { StringToBoolean } from '../../shared/transformer/index.js';
import { ConfigProperty, Configuration } from '../configuration/index.js';

export const STORAGE_CONFIG = 'STORAGE_CONFIG';
@Configuration()
export class StorageConfig {
	@IsString()
	@ConfigProperty()
	public S3_ENDPOINT!: string;

	@IsString()
	@ConfigProperty()
	public S3_BUCKET!: string;

	@IsNumber()
	@Type(() => Number)
	@ConfigProperty()
	public S3_PORT!: number;

	@IsBoolean()
	@StringToBoolean()
	@ConfigProperty()
	public S3_SSL!: boolean;

	@IsString()
	@ConfigProperty()
	public S3_ACCESS_KEY!: string;

	@IsString()
	@ConfigProperty()
	public S3_SECRET_KEY!: string;
}
