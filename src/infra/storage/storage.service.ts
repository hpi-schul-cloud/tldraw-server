import { Injectable } from '@nestjs/common';
import { Logger } from '../logging/logger.js';
import { StorageConfig } from './storage.config.js';

@Injectable()
export class StorageService {
	private readonly bucketName: string;

	public constructor(
		private readonly config: StorageConfig,
		private readonly logger: Logger,
	) {
		this.logger.setContext(StorageService.name);
		this.bucketName = this.config.S3_BUCKET;
	}

	public async get(): Promise<unknown> {
		this.logger.log('using s3 store');
		// @ts-expect-error - @y/redis is only having jsdoc types
		const { createS3Storage } = await import('@y/redis/storage/s3');

		const store = createS3Storage(this.bucketName);
		try {
			// make sure the bucket exists
			await store.client.makeBucket(this.bucketName);
		} catch (e) {}

		return store;
	}
}
