import { Injectable } from '@nestjs/common';
import { createS3Storage } from '../../infra/y-redis/s3.js';
import { AbstractStorage } from '../../infra/y-redis/storage.js';
import { Logger } from '../logging/logger.js';
import { StorageConfig } from './storage.config.js';

@Injectable()
export class StorageService {
	public constructor(
		private readonly config: StorageConfig,
		private readonly logger: Logger,
	) {
		this.logger.setContext(StorageService.name);
	}

	public get(): AbstractStorage {
		this.logger.log('using s3 store');

		const config = {
			bucketName: this.config.S3_BUCKET,
			endPoint: this.config.S3_ENDPOINT,
			port: this.config.S3_PORT,
			useSSL: this.config.S3_SSL,
			accessKey: this.config.S3_ACCESS_KEY,
			secretKey: this.config.S3_SECRET_KEY,
		};

		const store = createS3Storage(config);

		return store;
	}
}
