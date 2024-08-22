import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from '../logging/logger.js';

@Injectable()
export class StorageService {
	constructor(
		private configService: ConfigService,
		private logger: Logger,
	) {
		this.logger.setContext(StorageService.name);
	}

	async get() {
		const s3Endpoint = this.configService.get<string>('S3_ENDPOINT');
		const bucketName = this.configService.get<string>('S3_BUCKET') || 'ydocs';

		let store;

		if (s3Endpoint) {
			this.logger.log('using s3 store');
			const { createS3Storage } = await import('@y/redis/storage/s3');

			store = createS3Storage(bucketName);
			try {
				// make sure the bucket exists
				await store.client.makeBucket(bucketName);
			} catch (e) {}
		} else {
			this.logger.log('ATTENTION! using in-memory store');
			const { createMemoryStorage } = await import('@y/redis/storage/memory');
			store = createMemoryStorage();
		}
		return store;
	}
}
