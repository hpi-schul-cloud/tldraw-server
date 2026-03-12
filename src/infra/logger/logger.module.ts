import { Module } from '@nestjs/common';
import { utilities, WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { ConfigurationModule } from '../configuration/configuration.module.js';
import { LOGGER_CONFIG, LoggerConfig } from './logger.config.js';
import { Logger } from './logger.js';

@Module({
	imports: [
		WinstonModule.forRootAsync({
			imports: [ConfigurationModule.register(LOGGER_CONFIG, LoggerConfig)],
			useFactory: (config: LoggerConfig) => {
				return {
					levels: winston.config.syslog.levels,
					level: config.loggerLogLevel,
					exitOnError: config.loggerExitOnError,
					transports: [
						new winston.transports.Console({
							handleExceptions: true,
							handleRejections: true,
							format: winston.format.combine(
								winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
								winston.format.ms(),
								utilities.format.nestLike(),
							),
						}),
					],
				};
			},
			inject: [LOGGER_CONFIG],
		}),
	],
	providers: [Logger],
	exports: [Logger],
})
export class LoggerModule {}
