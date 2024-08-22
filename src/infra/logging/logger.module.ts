import { Module } from '@nestjs/common';
import { Logger } from './logger.js';

@Module({
	providers: [Logger],
	exports: [Logger],
})
export class LoggerModule {}
