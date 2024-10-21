import * as promise from 'lib0/promise';
import * as random from 'lib0/random';
import { Client } from 'minio';
import { Stream } from 'stream';
import * as Y from 'yjs';
import { AbstractStorage } from './storage.js';

interface S3StorageConf {
	bucketName: string;
	endPoint: string;
	port: number;
	useSSL: boolean;
	accessKey: string;
	secretKey: string;
}

/**
 * @typedef {import('../storage.js').AbstractStorage} AbstractStorage
 */

/**
 * @todo perform some sanity checks here before starting (bucket exists, ..)
 * @param {string} bucketName
 */
export const createS3Storage = (config: S3StorageConf): S3Storage => {
	const { bucketName, ...conf } = config;
	const client = new Client(conf);

	return new S3Storage(bucketName, client);
};

/**
 * @param {string} room
 * @param {string} docid
 */
export const encodeS3ObjectName = (room: string, docid: string, r = random.uuidv4()): string =>
	`${encodeURIComponent(room)}/${encodeURIComponent(docid)}/${r}`;

export const decodeS3ObjectName = (objectName: string): { room: string; docid: string; r: string } => {
	const match = objectName.match(/(.*)\/(.*)\/(.*)$/);
	if (match == null) {
		throw new Error('Malformed y:room stream name!');
	}

	return { room: decodeURIComponent(match[1]), docid: decodeURIComponent(match[2]), r: match[3] };
};

/**
 * @typedef {Object} S3StorageConf
 * @property {string} S3StorageConf.endPoint
 * @property {number} S3StorageConf.port
 * @property {boolean} S3StorageConf.useSSL
 * @property {string} S3StorageConf.accessKey
 * @property {string} S3StorageConf.secretKey
 */

const readStream = (stream: Stream): Promise<Buffer> =>
	promise.create((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on('data', (chunk: Uint8Array) => chunks.push(Buffer.from(chunk)));
		stream.on('error', reject);
		stream.on('end', () => resolve(Buffer.concat(chunks)));
	});

export class S3Storage extends AbstractStorage {
	public constructor(
		private readonly bucketName: string,
		private readonly client: Client,
	) {
		super();
	}

	public destroy(): Promise<void> {
		throw new Error('Method not implemented.');
	}

	public async persistDoc(room: string, docname: string, ydoc: Y.Doc): Promise<void> {
		const objectName = encodeS3ObjectName(room, docname);
		await this.client.putObject(this.bucketName, objectName, Buffer.from(Y.encodeStateAsUpdateV2(ydoc)));
	}

	public async retrieveDoc(room: string, docname: string): Promise<{ doc: Uint8Array; references: string[] } | null> {
		console.log('retrieving doc room=' + room + ' docname=' + docname);
		const objNames = await this.client
			.listObjectsV2(this.bucketName, encodeS3ObjectName(room, docname, ''), true)
			.toArray();
		const references: string[] = objNames.map((obj) => obj.name);
		console.log('retrieved doc room=' + room + ' docname=' + docname + ' refs=' + JSON.stringify(references));

		if (references.length === 0) {
			return null;
		}
		let updates: Uint8Array[] = await promise.all(
			references.map((ref) => this.client.getObject(this.bucketName, ref).then(readStream)),
		);
		updates = updates.filter((update) => update != null);
		console.log('retrieved doc room=' + room + ' docname=' + docname + ' updatesLen=' + updates.length);

		return { doc: Y.mergeUpdatesV2(updates), references };
	}

	public async retrieveStateVector(room: string, docname: string): Promise<Uint8Array | null> {
		const r = await this.retrieveDoc(room, docname);

		return r ? Y.encodeStateVectorFromUpdateV2(r.doc) : null;
	}

	public async deleteReferences(_room: string, _docname: string, storeReferences: string[]): Promise<void> {
		await this.client.removeObjects(this.bucketName, storeReferences);
	}

	public async deleteDocument(room: string, docname: string): Promise<void> {
		const objNames = await this.client
			.listObjectsV2(this.bucketName, encodeS3ObjectName(room, docname, ''), true)
			.toArray();
		const objectsList = objNames.map((obj) => obj.name);

		await this.client.removeObjects(this.bucketName, objectsList);
	}
}
