/** **********************************************************
 * This is a module facade.                                  *
 * Export only what is allowed to be used externally.        *
 * Do not use wildcard exports.                              *
 * Do not export *.app.module.ts here; import them directly. *
 *********************************************************** */

export { computeRedisRoomStreamName, decodeRedisRoomStreamName, RoomStreamInfos } from './helper.js';
export { YRedisClientModule } from './y-redis-client.module.js';
export { YRedisDoc } from './y-redis-doc.js';
export { YRedisServiceModule } from './y-redis-service.module.js';
export { YRedisUserFactory } from './y-redis-user.factory.js';
export { YRedisUser } from './y-redis-user.js';
export { YRedisClient } from './y-redis.client.js';
export { YRedisService } from './y-redis.service.js';
