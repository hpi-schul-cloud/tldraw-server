import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from '../logging/logger.js';

@Injectable()
export class StorageService {
	public constructor(
		private configService: ConfigService,
		private logger: Logger,
	) {
		this.logger.setContext(StorageService.name);
	}

	public async get(): Promise<unknown> {
		const s3Endpoint = this.configService.get<string>('S3_ENDPOINT');
		const bucketName = this.configService.get<string>('S3_BUCKET') ?? 'ydocs';

		let store;

		if (s3Endpoint) {
			this.logger.log('using s3 store');
			// @ts-expect-error - @y/redis is only having jsdoc types
			const { createS3Storage } = await import('@y/redis/storage/s3');

			store = createS3Storage(bucketName);
			try {
				// make sure the bucket exists
				await store.client.makeBucket(bucketName);
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
