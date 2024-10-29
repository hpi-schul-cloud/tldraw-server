import { Inject, Injectable, Scope } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger as WinstonLogger } from 'winston';
import { Loggable } from './interfaces/index.js';
import { LoggingUtils } from './logging.utils.js';

@Injectable({ scope: Scope.TRANSIENT })
export class Logger {
	private context = '';

	public constructor(@Inject(WINSTON_MODULE_PROVIDER) private readonly logger: WinstonLogger) {}

	public warning(loggable: Loggable): void {
		const message = LoggingUtils.createMessageWithContext(loggable, this.context);
		this.logger.warning(message);
	}

	public notice(loggable: Loggable): void {
		const message = LoggingUtils.createMessageWithContext(loggable, this.context);
		this.logger.notice(message);
	}

	public info(loggable: Loggable): void {
		const message = LoggingUtils.createMessageWithContext(loggable, this.context);
		this.logger.info(message);
	}

	public debug(loggable: Loggable): void {
		const message = LoggingUtils.createMessageWithContext(loggable, this.context);
		this.logger.debug(message);
	}

	public setContext(name: string): void {
		this.context = name;
	}
}
