import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum } from 'class-validator';

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

export class LoggerConfig {
	@IsEnum(LoggerLogLevel)
	public LOGGER_LOG_LEVEL!: LoggerLogLevel;

	@IsBoolean()
	@Transform(({ value }) => value === 'true')
	public LOGGER_EXIT_ON_ERROR = true;
}
