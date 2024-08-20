#!/usr/bin/env node

import * as yredis from '@y/redis';
import * as env from 'lib0/environment';
import { redis } from './redis.js';
import { initStorage } from './storage.js';

const redisPrefix = env.getConf('redis-prefix') || 'y';
const store = await initStorage();


yredis.createWorker(store, redisPrefix, {}, redis);
