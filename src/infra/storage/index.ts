/** **********************************************************
 * This is a module facade.                                  *
 * Export only what is allowed to be used externally.        *
 * Do not use wildcard exports.                              *
 * Do not export *.app.module.ts here; import them directly. *
 *********************************************************** */

export { StorageModule } from './storage.module.js';
export { encodeS3ObjectName, StorageService } from './storage.service.js';
