import * as dns from 'dns';
import { Redis } from "ioredis";
import * as env from 'lib0/environment';
import * as util from 'util';

const resolveSrv = util.promisify(dns.resolveSrv);


const sentinelPassword = env.getConf('redis-sentinel-password')
const sentinelName = env.getConf('redis-sentinel-name') || 'mymaster';
const sentinelServiceName = env.getConf('redis-sentinel-service-name');

async function discoverSentinelHosts() {
    try {
        const records = await resolveSrv(sentinelServiceName);

        const hosts = records.map(record => ({
            name: record.name,
            port: record.port,
            ip: ''
        }));

        // Get IP addresses for each host
        await Promise.all(hosts.map(async (host) => {
            const addresses = await dns.promises.lookup(host.name);
            host.ip = addresses.address;
        }));

        return hosts;
    } catch (err) {
        console.error('Error during service discovery:', err);
        throw err;
    }
}

export const redis = await (async () => {
    if (sentinelServiceName) {
        const sentinels = await discoverSentinelHosts();
        console.log('Discovered sentinels:', sentinels);

        return new Redis({
            sentinels,
            sentinelPassword,
            name: sentinelName,
        });
    } else {
        const redisUrl = env.ensureConf('redis')
        return new Redis(redisUrl);
    }
})();






