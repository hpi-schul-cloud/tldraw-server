import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
  constructor(private configService: ConfigService) {}

  async get() {
    const s3Endpoint = this.configService.get<string>('S3_ENDPOINT');
    const bucketName = this.configService.get<string>('S3_BUCKET') || 'ydocs';

    let store;

    if (s3Endpoint) {
      console.log('using s3 store');
      const { createS3Storage } = await import('@y/redis/storage/s3');

      store = createS3Storage(bucketName);
      try {
        // make sure the bucket exists
        await store.client.makeBucket(bucketName);
      } catch (e) {}
    } else {
      console.log('ATTENTION! using in-memory store');
      const { createMemoryStorage } = await import('@y/redis/storage/memory');
      store = createMemoryStorage();
    }
    return store;
  }
}
