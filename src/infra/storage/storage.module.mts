import { Module } from '@nestjs/common';
import { LoggerModule } from '../logging/logger.module.mjs';
import { StorageService } from './storage.service.mjs';

@Module({
    imports: [LoggerModule],
    providers: [StorageService],
    exports: [StorageService],
})
export class StorageModule {}
