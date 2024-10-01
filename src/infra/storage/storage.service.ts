import { Injectable } from '@nestjs/common';
import { Logger } from '../logging/logger.js';
import { StorageConfig } from './storage.config.js';

@Injectable()
export class StorageService {
	private s3Endpoint: string;
	private bucketName: string;

	public constructor(
		private config: StorageConfig,
		private logger: Logger,
	) {
		this.logger.setContext(StorageService.name);
		this.s3Endpoint = this.config.S3_ENDPOINT;
		this.bucketName = this.config.S3_BUCKET;
	}

	public async get(): Promise<unknown> {
		let store;

		if (this.s3Endpoint) {
			this.logger.log('using s3 store');
			// @ts-expect-error - @y/redis is only having jsdoc types
			const { createS3Storage } = await import('@y/redis/storage/s3');

			store = createS3Storage(this.bucketName);
			try {
				// make sure the bucket exists
				await store.client.makeBucket(this.bucketName);
			} catch (e) {}
		} else {
			this.logger.log('ATTENTION! using in-memory store');
			// @ts-expect-error - @y/redis is only having jsdoc types
			const { createMemoryStorage } = await import('@y/redis/storage/memory');
			store = createMemoryStorage();
		}

		return store;
	}
}
