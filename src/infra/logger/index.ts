/** **********************************************************
 * This is a module facade.                                  *
 * Export only what is allowed to be used externally.        *
 * Do not use wildcard exports.                              *
 * Do not export *.app.module.ts here; import them directly. *
 *********************************************************** */

export { RequestLoggingBody } from './interfaces/index.js';
export { LoggerConfig } from './logger.config.js';
export { Logger } from './logger.js';
export { LoggerModule } from './logger.module.js';
