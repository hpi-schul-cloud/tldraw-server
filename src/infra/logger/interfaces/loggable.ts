import { ErrorLogMessage, LogMessage, ValidationErrorLogMessage } from '../types/index.js';

export interface Loggable {
	getLogMessage(): LogMessage | ErrorLogMessage | ValidationErrorLogMessage;
}
