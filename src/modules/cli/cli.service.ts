import { Inject, Injectable, InternalServerErrorException, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Doc, applyUpdateV2 } from 'yjs';
import { Logger } from '../../infra/logger/index.js';
import { RedisAdapter } from '../../infra/redis/index.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import { REDIS_FOR_CLI } from './cli.const.js';

@Injectable()
export class CliService implements OnModuleInit {
	public readonly redisPrefix: string;

	public constructor(
		private readonly storage: StorageService,
		@Inject(REDIS_FOR_CLI) public readonly redis: RedisAdapter,
		private readonly logger: Logger,
	) {
		this.logger.setContext(CliService.name);
		this.redisPrefix = redis.redisPrefix;
	}

	public async onModuleInit(): Promise<void> {
		await this.redis.createGroup();
	}

	public async clearPendingDocumentStructs(room: string, docid = 'index'): Promise<boolean> {
		try {
			const docData = await this.storage.retrieveDoc(room, docid);
			if (!docData) {
				throw new NotFoundException(`Document ${room}/${docid} not found`);
			}

			const ydoc = new Doc();
			applyUpdateV2(ydoc, docData.doc);

			const pendingStructs = ydoc.store.pendingStructs;

			if (pendingStructs?.missing && pendingStructs.missing.size > 0) {
				ydoc.store.pendingStructs = null;
			} else {
				this.logger.debug(`No missing structs for document ${room}/${docid}`);

				return true;
			}

			await this.storage.persistDoc(room, docid, ydoc);

			if (docData.references) {
				await this.storage.deleteReferences(room, docid, docData.references);
			}

			this.logger.info(`Successfully cleared struct for document ${room}/${docid}`);

			return true;
		} catch (error) {
			throw new InternalServerErrorException(`Failed to remove missing struct:`, { cause: error });
		}
	}
}
