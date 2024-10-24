import { Module } from '@nestjs/common';
import { Client } from 'minio';
import { ConfigurationModule } from '../configuration/configuration.module.js';
import { LoggerModule } from '../logging/logger.module.js';
import { StorageConfig } from './storage.config.js';
import { StorageService } from './storage.service.js';

@Module({
	imports: [LoggerModule, ConfigurationModule.register(StorageConfig)],
	providers: [
		StorageService,
		{
			provide: Client,
			useFactory: (config: StorageConfig): Client => {
				return new Client({
					endPoint: config.S3_ENDPOINT,
					port: config.S3_PORT,
					useSSL: config.S3_SSL,
					accessKey: config.S3_ACCESS_KEY,
					secretKey: config.S3_SECRET_KEY,
				});
			},
			inject: [StorageConfig],
		},
	],
	exports: [StorageService],
})
export class StorageModule {}
