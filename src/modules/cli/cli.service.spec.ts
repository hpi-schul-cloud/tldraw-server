import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { applyUpdateV2, Doc } from 'yjs';
import { Logger } from '../../infra/logger/index.js';
import { RedisAdapter } from '../../infra/redis/index.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import { REDIS_FOR_CLI } from './cli.const.js';
import { CliService } from './cli.service.js';

// Mock YJS
jest.mock('yjs', () => {
	return {
		Doc: jest.fn().mockImplementation(() => {
			return {
				store: {
					pendingStructs: null,
				},
			};
		}),
		applyUpdateV2: jest.fn(),
	};
});

describe(CliService.name, () => {
	let module: TestingModule;
	let cliService: CliService;
	let redisAdapter: DeepMocked<RedisAdapter>;
	let storageService: DeepMocked<StorageService>;
	let logger: DeepMocked<Logger>;
	let mockApplyUpdateV2: jest.MockedFunction<typeof applyUpdateV2>;

	beforeEach(async () => {
		module = await Test.createTestingModule({
			providers: [
				CliService,
				{
					provide: StorageService,
					useValue: createMock<StorageService>(),
				},
				{
					provide: REDIS_FOR_CLI,
					useValue: createMock<RedisAdapter>(),
				},
				{
					provide: Logger,
					useValue: createMock<Logger>(),
				},
			],
		}).compile();

		cliService = module.get(CliService);
		redisAdapter = module.get(REDIS_FOR_CLI);
		storageService = module.get(StorageService);
		logger = module.get(Logger);
		mockApplyUpdateV2 = jest.mocked(applyUpdateV2);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('should be defined', () => {
		expect(cliService).toBeDefined();
	});

	describe('onModuleInit', () => {
		it('should call redis.createGroup', async () => {
			await cliService.onModuleInit();

			expect(redisAdapter.createGroup).toHaveBeenCalledTimes(1);
		});

		it('should throw error if redis.createGroup fails', async () => {
			const error = new Error('Redis connection failed');
			jest.mocked(redisAdapter.createGroup).mockRejectedValue(error);

			await expect(cliService.onModuleInit()).rejects.toThrow('Redis connection failed');
		});
	});

	describe('onModuleDestroy', () => {
		it('should call redis.quit and log info message', async () => {
			await cliService.onModuleDestroy();

			expect(redisAdapter.quit).toHaveBeenCalledTimes(1);
			expect(logger.info).toHaveBeenCalledWith('Disconnecting Redis client');
		});
	});

	describe('constructor', () => {
		it('should set logger context and redis prefix', () => {
			expect(logger.setContext).toHaveBeenCalledWith(CliService.name);
			expect(cliService.redisPrefix).toBe(redisAdapter.redisPrefix);
		});
	});

	describe('clearPendingDocumentStructs', () => {
		beforeEach(() => {
			jest.clearAllMocks();
			// eslint-disable-next-line @typescript-eslint/no-empty-function
			mockApplyUpdateV2.mockImplementation(() => {});
		});

		describe('when document is found and has index docid', () => {
			const setup = () => {
				const room = 'test-room';
				const mockDocData = {
					doc: new Uint8Array([0, 0]),
					references: [] as string[],
				};

				storageService.retrieveDoc.mockResolvedValue(mockDocData);

				return { room, mockDocData };
			};

			it('should call retrieveDoc with room and "index"', async () => {
				const { room } = setup();

				await cliService.clearPendingDocumentStructs(room);

				expect(storageService.retrieveDoc).toHaveBeenCalledWith(room, 'index');
			});
		});

		describe('when document is not found', () => {
			const setup = () => {
				const room = 'test-room';
				storageService.retrieveDoc.mockResolvedValue(null);

				return { room };
			};

			it('should return false and log info message', async () => {
				const { room } = setup();

				const result = await cliService.clearPendingDocumentStructs(room);

				expect(result).toBe(false);
				expect(logger.info).toHaveBeenCalledWith(`Document ${room} not found`);
			});
		});

		describe('when no missing structs exist', () => {
			const setup = () => {
				const room = 'test-room';
				const mockDocData = {
					doc: new Uint8Array([0, 0]),
					references: [] as string[],
				};
				storageService.retrieveDoc.mockResolvedValue(mockDocData);

				return { room, mockDocData };
			};

			it('should return true and log info message', async () => {
				const { room } = setup();

				const result = await cliService.clearPendingDocumentStructs(room);

				expect(result).toBe(true);
				expect(logger.info).toHaveBeenCalledWith(`No missing structs for document ${room}`);
				expect(storageService.persistDoc).not.toHaveBeenCalled();
			});
		});

		describe('when missing structs exist with references', () => {
			const setup = () => {
				const room = 'test-room';
				const references = ['ref1', 'ref2'];
				const mockDocData = {
					doc: new Uint8Array([0, 0]),
					references,
				};
				storageService.retrieveDoc.mockResolvedValue(mockDocData);

				// Mock YJS Doc with missing structs

				const mockDocInstance = {
					store: {
						pendingStructs: { missing: new Map([[1, 2]]) },
					},
				};
				const MockedDoc = Doc as jest.MockedClass<typeof Doc>;
				MockedDoc.mockImplementation(() => mockDocInstance as Doc);

				return { room, references, mockDocData, mockDocInstance };
			};

			it('should clear structs, persist doc and delete references', async () => {
				const { room, references, mockDocInstance } = setup();

				const result = await cliService.clearPendingDocumentStructs(room);

				expect(result).toBe(true);
				expect(mockDocInstance.store.pendingStructs).toBe(null);
				expect(storageService.persistDoc).toHaveBeenCalledWith(room, 'index', expect.any(Object));
				expect(storageService.deleteReferences).toHaveBeenCalledWith(room, 'index', references);
				expect(logger.info).toHaveBeenCalledWith(`Successfully cleared struct for document ${room}`);
			});
		});

		describe('when missing structs exist without references', () => {
			const setup = () => {
				const room = 'test-room';
				// When storage returns null (no document found)
				storageService.retrieveDoc.mockResolvedValue(null);

				return { room };
			};

			it('should return false and log info message', async () => {
				const { room } = setup();

				const result = await cliService.clearPendingDocumentStructs(room);

				expect(result).toBe(false);
				expect(logger.info).toHaveBeenCalledWith(`Document ${room} not found`);
				expect(storageService.persistDoc).not.toHaveBeenCalled();
				expect(storageService.deleteReferences).not.toHaveBeenCalled();
			});
		});

		describe('when missing structs exist with empty references', () => {
			const setup = () => {
				const room = 'test-room';
				const mockDocData = {
					doc: new Uint8Array([0, 0]),
					references: [] as string[], // Empty array - document exists but no references
				};
				storageService.retrieveDoc.mockResolvedValue(mockDocData);

				// Mock YJS Doc with missing structs
				const MockedDoc = Doc as jest.MockedClass<typeof Doc>;
				const mockDocInstance = {
					store: {
						pendingStructs: { missing: new Map([[1, 2]]) },
					},
				};
				MockedDoc.mockImplementation(() => mockDocInstance as Doc);

				return { room, mockDocData, mockDocInstance };
			};

			it('should clear structs and persist doc and call deleteReferences with empty array', async () => {
				const { room, mockDocInstance } = setup();

				const result = await cliService.clearPendingDocumentStructs(room);

				expect(result).toBe(true);
				expect(mockDocInstance.store.pendingStructs).toBe(null);
				expect(storageService.persistDoc).toHaveBeenCalledWith(room, 'index', expect.any(Object));
				expect(storageService.deleteReferences).toHaveBeenCalledWith(room, 'index', []);
				expect(logger.info).toHaveBeenCalledWith(`Successfully cleared struct for document ${room}`);
			});
		});

		describe('when pendingStructs is null', () => {
			const setup = () => {
				const room = 'test-room';
				const mockDocData = {
					doc: new Uint8Array([0, 0]),
					references: [] as string[],
				};
				storageService.retrieveDoc.mockResolvedValue(mockDocData);

				// Mock YJS Doc with null pending structs
				const MockedDoc = Doc as jest.MockedClass<typeof Doc>;
				MockedDoc.mockImplementation(
					() =>
						({
							store: {
								pendingStructs: null,
							},
						}) as Doc,
				);

				return { room, mockDocData };
			};

			it('should return true and log info message without persisting', async () => {
				const { room } = setup();

				const result = await cliService.clearPendingDocumentStructs(room);

				expect(result).toBe(true);
				expect(logger.info).toHaveBeenCalledWith(`No missing structs for document ${room}`);
				expect(storageService.persistDoc).not.toHaveBeenCalled();
			});
		});

		describe('when storage.retrieveDoc fails', () => {
			const setup = () => {
				const room = 'test-room';
				const storageError = new Error('Storage error');
				storageService.retrieveDoc.mockRejectedValue(storageError);

				return { room, storageError };
			};

			it('should throw InternalServerErrorException', async () => {
				const { room } = setup();

				await expect(cliService.clearPendingDocumentStructs(room)).rejects.toThrow(InternalServerErrorException);
				await expect(cliService.clearPendingDocumentStructs(room)).rejects.toThrow('Failed to remove missing struct:');
			});
		});

		describe('when storage.persistDoc fails', () => {
			const setup = () => {
				const room = 'test-room';
				const mockDocData = {
					doc: new Uint8Array([0, 0]),
					references: [] as string[],
				};
				storageService.retrieveDoc.mockResolvedValue(mockDocData);

				// Mock YJS Doc with missing structs
				const MockedDoc = Doc as jest.MockedClass<typeof Doc>;
				MockedDoc.mockImplementation(
					() =>
						({
							store: {
								pendingStructs: { missing: new Map([[1, 2]]) },
							},
						}) as Doc,
				);

				const persistError = new Error('Persist error');
				storageService.persistDoc.mockRejectedValue(persistError);

				return { room, persistError };
			};

			it('should throw InternalServerErrorException', async () => {
				const { room } = setup();

				await expect(cliService.clearPendingDocumentStructs(room)).rejects.toThrow(InternalServerErrorException);
				await expect(cliService.clearPendingDocumentStructs(room)).rejects.toThrow('Failed to remove missing struct:');
			});
		});

		describe('when storage.deleteReferences fails', () => {
			const setup = () => {
				const room = 'test-room';
				const references = ['ref1', 'ref2'];
				const mockDocData = {
					doc: new Uint8Array([0, 0]),
					references,
				};
				storageService.retrieveDoc.mockResolvedValue(mockDocData);

				// Mock YJS Doc with missing structs
				const MockedDoc = Doc as jest.MockedClass<typeof Doc>;
				MockedDoc.mockImplementation(
					() =>
						({
							store: {
								pendingStructs: { missing: new Map([[1, 2]]) },
							},
						}) as Doc,
				);

				storageService.persistDoc.mockResolvedValue(undefined);
				const deleteError = new Error('Delete error');
				storageService.deleteReferences.mockRejectedValue(deleteError);

				return { room, deleteError };
			};

			it('should throw InternalServerErrorException', async () => {
				const { room } = setup();

				await expect(cliService.clearPendingDocumentStructs(room)).rejects.toThrow(InternalServerErrorException);
				await expect(cliService.clearPendingDocumentStructs(room)).rejects.toThrow('Failed to remove missing struct:');
			});
		});
	});
});
