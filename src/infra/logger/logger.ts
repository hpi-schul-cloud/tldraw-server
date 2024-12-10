import { Inject, Injectable, Scope } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import * as util from 'util';
import * as winston from 'winston';
import { RequestLoggingBody } from './interfaces/index.js';

@Injectable({ scope: Scope.TRANSIENT })
export class Logger {
	/**
	 * This Logger Service can be injected into every Class,
	 * use setContext() with CustomProviderClass.name that will be added to every log.
	 * It implements @ILogger which provides the logger methods.
	 * CAUTION: PREPARE STRINGS AS LOG DATA, DO NOT LOG COMPLEX DATA STRUCTURES
	 */
	private context = '';

	public constructor(@Inject(WINSTON_MODULE_PROVIDER) private readonly logger: winston.Logger) {}

	public log(message: unknown, context?: string): void {
		this.logger.info(this.createMessage(message, context));
	}

	public warning(message: unknown, context?: string): void {
		this.logger.warning(this.createMessage(message, context));
	}

	public debug(message: unknown, context?: string): void {
		this.logger.debug(this.createMessage(message, context));
	}

	public http(message: RequestLoggingBody, context?: string): void {
		this.logger.notice(this.createMessage(message, context));
	}

	public setContext(name: string): void {
		this.context = name;
	}

	private createMessage(
		message: unknown,
		context?: string | undefined,
	): {
		message: string;
		context: string;
	} {
		return { message: this.stringifiedMessage(message), context: context ?? this.context };
	}

	private stringifiedMessage(message: unknown): string {
		const stringifiedMessage = util.inspect(message).replace(/\n/g, '').replace(/\\n/g, '');

		return stringifiedMessage;
	}
}
