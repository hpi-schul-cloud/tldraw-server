import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../configuration/configuration.module.js';
import { LoggerModule } from '../logging/logger.module.js';
import { StorageConfig } from './storage.config.js';
import { StorageService } from './storage.service.js';

@Module({
	imports: [LoggerModule, ConfigurationModule.register(StorageConfig)],
	providers: [StorageService],
	exports: [StorageService],
})
export class StorageModule {}
