/** **********************************************************
 * This is a module facade.                                  *
 * Export only what is allowed to be used externally.        *
 * Do not use wildcard exports.                              *
 * Do not export *.app.module.ts here; import them directly. *
 *********************************************************** */

export {
	RedisAdapter,
	StreamMessageReply,
	StreamMessagesReply,
	StreamNameClockPair,
	Task,
	XAutoClaimResponse,
} from './interfaces/index.js';
export { RedisFactory } from './redis.factory.js';
export { RedisModule } from './redis.module.js';
