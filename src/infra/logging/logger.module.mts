
import { Module } from '@nestjs/common';
import { Logger } from './logger.mjs';

@Module({
    providers: [Logger],
    exports: [Logger]
})
export class LoggerModule {}