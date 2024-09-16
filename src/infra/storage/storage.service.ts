import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from '../logging/logger.js';

@Injectable()
export class StorageService {
	private internalStorageInstance?: any;
	private s3Endpoint: string;
	private bucketName: string;

	constructor(
		private configService: ConfigService,
		private logger: Logger,
	) {
		this.logger.setContext(StorageService.name);
		this.s3Endpoint = this.configService.getOrThrow<string>('S3_ENDPOINT');
		this.bucketName = this.configService.get<string>('S3_BUCKET') || 'ydocs';
	}

	public async get() {
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

	public async deleteDocument(parentId: string): Promise<void> {
		const store = await this.getInternalStorageInstance();

		const objectsList = [];
		const stream = store.client.listObjectsV2(this.bucketName, parentId, true);

		for await (const obj of stream) {
			objectsList.push(obj.name);
		}

		await store.client.removeObjects(this.bucketName, objectsList);
	}

	private async getInternalStorageInstance(): Promise<any> {
		if (!this.internalStorageInstance) {
			this.internalStorageInstance = await this.get();
		}

		return this.internalStorageInstance;
	}
}
