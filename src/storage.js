import * as env from 'lib0/environment'

export const initStorage = async () => {
    const s3Endpoint = env.getConf('s3-endpoint')
    const bucketName = env.getConf('s3-bucket') || "ydocs"

    let store
    if (s3Endpoint) {
        console.log('using s3 store')
        const { createS3Storage } = await import('@y/redis/storage/s3')

        store = createS3Storage(bucketName)
        try {
            // make sure the bucket exists
            await store.client.makeBucket(bucketName)
        } catch (e) { }
    } else {
        console.log('ATTENTION! using in-memory store')
        const { createMemoryStorage } = await import('@y/redis/storage/memory')
        store = createMemoryStorage()
    }
    return store
}