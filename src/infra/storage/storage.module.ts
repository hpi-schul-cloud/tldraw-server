import { Module } from '@nestjs/common';
import { Client } from 'minio';
import { ConfigurationModule } from '../configuration/configuration.module.js';
import { LoggerModule } from '../logger/logger.module.js';
import { STORAGE_CONFIG, StorageConfig } from './storage.config.js';
import { StorageService } from './storage.service.js';

@Module({
	imports: [LoggerModule, ConfigurationModule.register(STORAGE_CONFIG, StorageConfig)],
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
			inject: [STORAGE_CONFIG],
		},
	],
	exports: [StorageService],
})
export class StorageModule {}
