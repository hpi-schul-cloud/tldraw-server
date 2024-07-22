#!/usr/bin/env node
// @ts-nocheck

import { registerYWebsocketServer } from '@y/redis'
import * as env from 'lib0/environment'
import * as error from 'lib0/error'
import * as logging from 'lib0/logging'
import * as number from 'lib0/number'
import * as promise from 'lib0/promise'
import * as uws from 'uws'
import { initStorage } from './storage.js'

const apiHost = env.getConf('api-host') || 'http://localhost:3030';
const wsPathPrefix = env.getConf('ws-path-prefix') || '';

/**
 *
 * @param {string} room
 * @param {string} token
 * @returns
 */
const checkPermission = async (room, token) => {
    const requestOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token,
        },
        body: JSON.stringify({
            context: {
                action: "read",
                requiredPermissions: ["COURSE_EDIT"]
            },
            referenceType: "boardnodes",
            referenceId: room
        })
    };
    const response = await fetch(`${apiHost}/api/v3/authorization/by-reference`, requestOptions);
    return response;
}


class YWebsocketServer {
    /**
     * @param {uws.TemplatedApp} app
     */
    constructor(app) {
        this.app = app
    }

    async destroy() {
        this.app.close()
    }
}

/**
 * @param {Object} opts
 * @param {number} opts.port
 * @param {import('@y/redis/storage.js').AbstractStorage} opts.store
 * @param {string} [opts.redisPrefix]
 * @param {(room:string,docname:string,client:import('./api.js').Api)=>void} [opts.initDocCallback] -
 * this is called when a doc is accessed, but it doesn't exist. You could populate the doc here.
 * However, this function could be called several times, until some content exists. So you need to
 * handle concurrent calls.
 */
export const createYWebsocketServer = async ({
    redisPrefix = 'y',
    port,
    store,
    initDocCallback = () => { }
}) => {

    const app = uws.App({})
    await registerYWebsocketServer(app, `${wsPathPrefix}/:room`, store, async (req) => {
        const room = req.getParameter(0)
        const headerWsProtocol = req.getHeader('sec-websocket-protocol')
        const [, , token] = /(^|,)yauth-(((?!,).)*)/.exec(headerWsProtocol) ?? [null, null, req.getQuery('yauth')]
        if (token == null) {
            throw new Error('Missing Token')
        }
        // @todo add user id for jwt
        try {
            await checkPermission(room, token);
            return { hasWriteAccess: true, room, userid: '' }
        } catch (e) {
            throw e
        }
    }, { redisPrefix, initDocCallback })

    await promise.create((resolve, reject) => {
        app.listen(port, (token) => {
            if (token) {
                logging.print(logging.GREEN, '[y-redis] Listening to port ', port)
                resolve()
            } else {
                const err = error.create('[y-redis] Failed to lisen to port ' + port)
                reject(err)
                throw err
            }
        })
    })
    return new YWebsocketServer(app)
}

const port = number.parseInt(env.getConf('port') || '3345')
const redisPrefix = env.getConf('redis-prefix') || 'y'
const store = await initStorage()

createYWebsocketServer({ port, store, redisPrefix })
