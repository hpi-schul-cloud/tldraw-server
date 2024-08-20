import { Module } from '@nestjs/common';
import { StorageService } from './storage.service.mjs';

@Module({
    providers: [StorageService],
    exports: [StorageService],
})
export class StorageModule {}
