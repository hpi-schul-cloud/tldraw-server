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
					endPoint: config.s3Endpoint,
					port: config.s3Port,
					useSSL: config.s3Ssl,
					accessKey: config.s3AccessKey,
					secretKey: config.s3SecretKey,
				});
			},
			inject: [STORAGE_CONFIG],
		},
	],
	exports: [StorageService],
})
export class StorageModule {}
