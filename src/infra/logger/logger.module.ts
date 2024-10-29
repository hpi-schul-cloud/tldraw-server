import { Module } from '@nestjs/common';
import { utilities, WinstonModule } from 'nest-winston';
import winston from 'winston';
import { ConfigurationModule } from '../configuration/configuration.module.js';
import { LoggerConfig } from './logger.config.js';
import { Logger } from './logger.js';

@Module({
	imports: [
		WinstonModule.forRootAsync({
			imports: [ConfigurationModule.register(LoggerConfig)],
			useFactory: (config: LoggerConfig) => {
				return {
					levels: winston.config.syslog.levels,
					level: config.NEST_LOG_LEVEL,
					exitOnError: config.EXIT_ON_ERROR,
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
			inject: [LoggerConfig],
		}),
	],
	providers: [Logger],
	exports: [Logger],
})
export class LoggerModule {}
