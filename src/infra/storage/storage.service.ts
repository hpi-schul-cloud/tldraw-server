import { Injectable, OnModuleInit } from '@nestjs/common';
import { Client } from 'minio';
import { randomUUID } from 'crypto';
import { Stream } from 'stream';
import * as Y from 'yjs';
import { Logger } from '../logger/index.js';
import { DocumentStorage } from '../y-redis/storage.js';
import { StorageConfig } from './storage.config.js';

export const encodeS3ObjectName = (room: string, docid: string, r = ''): string =>
	`${encodeURIComponent(room)}/${encodeURIComponent(docid)}/${r}`;

const readStream = (stream: Stream): Promise<Buffer> =>
	new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on('data', (chunk: Uint8Array) => chunks.push(Buffer.from(chunk)));
		stream.on('error', reject);
		stream.on('end', () => resolve(Buffer.concat(chunks)));
	});

@Injectable()
export class StorageService implements DocumentStorage, OnModuleInit {
	public constructor(
		private readonly client: Client,
		private readonly config: StorageConfig,
		private readonly logger: Logger,
	) {
		this.logger.setContext(StorageService.name);
	}

	public async onModuleInit(): Promise<void> {
		const bucketExists = await this.client.bucketExists(this.config.S3_BUCKET);

		if (!bucketExists) {
			await this.client.makeBucket(this.config.S3_BUCKET);
		}
	}

	public async persistDoc(room: string, docname: string, ydoc: Y.Doc): Promise<void> {
		const objectName = encodeS3ObjectName(room, docname, randomUUID());
		await this.client.putObject(this.config.S3_BUCKET, objectName, Buffer.from(Y.encodeStateAsUpdateV2(ydoc)));
	}

	public async retrieveDoc(room: string, docname: string): Promise<{ doc: Uint8Array; references: string[] } | null> {
		this.logger.log('retrieving doc room=' + room + ' docname=' + docname);

		const objNames = await this.client
			.listObjectsV2(this.config.S3_BUCKET, encodeS3ObjectName(room, docname), true)
			.toArray();
		const references: string[] = objNames.map((obj) => obj.name);

		this.logger.log('retrieved doc room=' + room + ' docname=' + docname + ' refs=' + JSON.stringify(references));

		if (references.length === 0) {
			return null;
		}

		let updates: Uint8Array[] = await Promise.all(
			references.map(async (ref) => {
				const stream = await this.client.getObject(this.config.S3_BUCKET, ref);

				const readStreamPomise = readStream(stream).catch(() => {
					throw new Error('Error on storage stream read');
				});

				return readStreamPomise;
			}),
		);
		updates = updates.filter((update) => update != null);
		this.logger.log('retrieved doc room=' + room + ' docname=' + docname + ' updatesLen=' + updates.length);

		return { doc: Y.mergeUpdatesV2(updates), references };
	}

	public async retrieveStateVector(room: string, docname: string): Promise<Uint8Array | null> {
		const r = await this.retrieveDoc(room, docname);

		return r ? Y.encodeStateVectorFromUpdateV2(r.doc) : null;
	}

	public async deleteReferences(_room: string, _docname: string, storeReferences: string[]): Promise<void> {
		await this.client.removeObjects(this.config.S3_BUCKET, storeReferences);
	}

	public async deleteDocument(room: string, docname: string): Promise<void> {
		const objNames = await this.client
			.listObjectsV2(this.config.S3_BUCKET, encodeS3ObjectName(room, docname), true)
			.toArray();
		const objectsList = objNames.map((obj) => obj.name);

		await this.client.removeObjects(this.config.S3_BUCKET, objectsList);
	}

	public destroy(): Promise<void> {
		throw new Error('Method not implemented.');
	}
}
