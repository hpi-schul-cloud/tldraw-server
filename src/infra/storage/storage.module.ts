import { Module } from '@nestjs/common';
import { LoggerModule } from '../logging/logger.module.js';
import { StorageService } from './storage.service.js';

@Module({
    imports: [LoggerModule],
    providers: [StorageService],
    exports: [StorageService],
})
export class StorageModule {}
