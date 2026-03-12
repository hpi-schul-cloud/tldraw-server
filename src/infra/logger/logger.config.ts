import { IsBoolean, IsEnum } from 'class-validator';
import { StringToBoolean } from '../../shared/transformer/index.js';
import { ConfigProperty, Configuration } from '../configuration/index.js';

export enum LoggerLogLevel {
	emerg = 'emerg',
	alert = 'alert',
	crit = 'crit',
	error = 'error',
	warning = 'warning',
	notice = 'notice',
	info = 'info',
	debug = 'debug',
}

export const LOGGER_CONFIG = 'LOGGER_CONFIG';
@Configuration()
export class LoggerConfig {
	@IsEnum(LoggerLogLevel)
	@ConfigProperty('LOGGER_LOG_LEVEL')
	public loggerLogLevel!: LoggerLogLevel;

	@IsBoolean()
	@StringToBoolean()
	@ConfigProperty('LOGGER_EXIT_ON_ERROR')
	public loggerExitOnError = true;
}
