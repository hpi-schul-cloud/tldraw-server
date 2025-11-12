import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Test } from '@nestjs/testing';
import { BucketItem, BucketStream, Client } from 'minio';
import { Readable } from 'stream';
import * as Y from 'yjs';
import { Logger } from '../logger/index.js';
import { StorageConfig } from './storage.config.js';
import { StorageService } from './storage.service.js';

describe('StorageService', () => {
	let service: StorageService;
	let client: DeepMocked<Client>;
	const bucketName = 'bucket-name';

	beforeAll(async () => {
		const moduleFixture = await Test.createTestingModule({
			providers: [
				StorageService,
				{
					provide: Client,
					useValue: createMock<Client>(),
				},
				{
					provide: StorageConfig,
					useValue: {
						S3_BUCKET: bucketName,
					},
				},
				{
					provide: Logger,
					useValue: createMock<Logger>(),
				},
			],
		}).compile();

		service = moduleFixture.get(StorageService);
		await service.onModuleInit();
		client = moduleFixture.get(Client);
	});

	beforeEach(() => {
		jest.resetAllMocks();
	});

	describe('persistDoc', () => {
		describe('when putObject resolves', () => {
			const setup = () => {
				const uploadedObjectInfoMock = { etag: 'etag', versionId: 'versionId' };
				client.putObject.mockResolvedValueOnce(uploadedObjectInfoMock);
				const room = 'room';
				const docname = 'docname';
				const r = new Uint8Array(0);
				const yDocMock = createMock<Y.Doc>();
				const yDocMockEncoded = new Uint8Array(1);
				jest.spyOn(Y, 'encodeStateAsUpdateV2').mockReturnValueOnce(yDocMockEncoded);
				const uuidRegex = /room\/docname\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

				return { room, docname, r, uploadedObjectInfoMock, yDocMock, yDocMockEncoded, uuidRegex };
			};

			it('should call putObject', async () => {
				const { room, docname, yDocMock, uuidRegex, yDocMockEncoded } = setup();

				await service.persistDoc(room, docname, yDocMock);

				expect(client.putObject).toHaveBeenCalledWith(
					bucketName,
					expect.stringMatching(uuidRegex),
					Buffer.from(yDocMockEncoded),
				);
			});
		});

		describe('when putObject rejects', () => {
			const setup = () => {
				const error = new Error();
				const yDocMock = createMock<Y.Doc>();
				const yDocMockEncoded = new Uint8Array(1);

				client.putObject.mockRejectedValueOnce(error);
				jest.spyOn(Y, 'encodeStateAsUpdateV2').mockReturnValueOnce(yDocMockEncoded);

				return { error, yDocMock };
			};

			it('should throw an error', async () => {
				const { error, yDocMock } = setup();

				await expect(service.persistDoc('room', 'docname', yDocMock)).rejects.toThrow(error);
			});
		});
	});

	describe('retrieveDoc', () => {
		describe('when listObjectsV2 rejects', () => {
			const setup = () => {
				const error = new Error('error');
				const returnValue = { toArray: jest.fn().mockRejectedValueOnce(error) };
				client.listObjectsV2.mockReturnValueOnce(returnValue as unknown as BucketStream<BucketItem>);

				return { error };
			};

			it('should throw an error', async () => {
				const { error } = setup();

				await expect(service.retrieveDoc('room', 'docname')).rejects.toThrow(error);
			});
		});

		describe('when listObjectsV2 resolves', () => {
			describe('when references is empty', () => {
				const setup = () => {
					const returnValue = { toArray: jest.fn().mockResolvedValueOnce([]) };
					client.listObjectsV2.mockReturnValueOnce(returnValue as unknown as BucketStream<BucketItem>);

					return returnValue;
				};

				it('should return null', async () => {
					setup();

					const result = await service.retrieveDoc('room', 'docname');

					expect(result).toBeNull();
				});
			});

			describe('when references is not empty', () => {
				describe('when getObject rejects', () => {
					const setup = () => {
						const objNames = [{ name: 'obj1' }, { name: 'obj2' }];
						const returnValue = { toArray: jest.fn().mockResolvedValueOnce(objNames) };
						client.listObjectsV2.mockReturnValue(returnValue as unknown as BucketStream<BucketItem>);

						const dataChunk = new Uint8Array(5);
						const error = new Error('error');
						const stream = new Readable({
							read() {
								this.emit('data', dataChunk);
								this.emit('end');
							},
						});
						client.getObject.mockResolvedValueOnce(stream);
						client.getObject.mockRejectedValueOnce(error);

						return { error };
					};

					it('should reject', async () => {
						const { error } = setup();

						await expect(service.retrieveDoc('room', 'docname')).rejects.toThrow(error);
					});
				});

				describe('when error is emitted on stream', () => {
					const setup = () => {
						const objNames = [{ name: 'obj1' }, { name: 'obj2' }];
						const returnValue = { toArray: jest.fn().mockResolvedValueOnce(objNames) };
						client.listObjectsV2.mockReturnValueOnce(returnValue as unknown as BucketStream<BucketItem>);

						const errroStream = new Readable({
							read() {
								this.emit('error');
							},
						});
						client.getObject.mockResolvedValueOnce(errroStream);

						const dataChunk = new Uint8Array(5);
						const dataStram = new Readable({
							read() {
								this.emit('data', dataChunk);
								this.emit('end');
							},
						});
						client.getObject.mockResolvedValueOnce(dataStram);
					};

					it('should reject', async () => {
						setup();

						await expect(service.retrieveDoc('room', 'docname')).rejects.toThrow();
					});
				});

				describe('when data and end events are emitted on stream', () => {
					const setup = () => {
						const objNames = [{ name: 'obj1' }, { name: 'obj2' }];
						const returnValue = { toArray: jest.fn().mockResolvedValueOnce(objNames) };
						client.listObjectsV2.mockReturnValueOnce(returnValue as unknown as BucketStream<BucketItem>);

						const dataChunk = new Uint8Array(5);
						const stream = new Readable({
							read() {
								this.emit('data', dataChunk);
								this.emit('end');
							},
						});
						client.getObject.mockResolvedValueOnce(stream);
						client.getObject.mockResolvedValueOnce(stream);

						const doc = new Uint8Array(0);
						const mergeUpdatesV2Spy = jest.spyOn(Y, 'mergeUpdatesV2').mockReturnValueOnce(doc);

						return { doc, mergeUpdatesV2Spy, dataChunk };
					};

					// How is this case possible?
					/* it('should remove null chunks', async () => {
						const { mergeUpdatesV2Spy, dataChunk } = setup();

						await service.retrieveDoc('room', 'docname');

						expect(mergeUpdatesV2Spy).toHaveBeenCalledWith([
							Buffer.concat([Buffer.from(dataChunk)]),
							Buffer.concat([Buffer.from(dataChunk)]),
						]);
					}); */

					it('should call mergeUpdatesV2 with updates', async () => {
						const { mergeUpdatesV2Spy, dataChunk } = setup();

						await service.retrieveDoc('room', 'docname');

						expect(mergeUpdatesV2Spy).toHaveBeenCalledWith([
							Buffer.concat([Buffer.from(dataChunk)]),
							Buffer.concat([Buffer.from(dataChunk)]),
						]);
					});

					it('should return doc and references', async () => {
						const { doc } = setup();

						const result = await service.retrieveDoc('room', 'docname');

						expect(result).toEqual({ doc, references: ['obj1', 'obj2'] });
					});
				});
			});
		});
	});

	describe('retrieveStateVector', () => {
		describe('when retrieveDoc rejects', () => {
			const setup = () => {
				const error = new Error();
				jest.spyOn(service, 'retrieveDoc').mockRejectedValueOnce(error);

				return { error };
			};

			it('should throw an error', async () => {
				const { error } = setup();

				await expect(service.retrieveStateVector('room', 'docname')).rejects.toThrow(error);
			});
		});

		describe('when retrieveDoc resolves', () => {
			describe('when retrieveDoc returns null', () => {
				const setup = () => {
					jest.spyOn(service, 'retrieveDoc').mockResolvedValueOnce(null);

					return null;
				};

				it('should return null', async () => {
					setup();

					const result = await service.retrieveStateVector('room', 'docname');

					expect(result).toBeNull();
				});
			});

			describe('when retrieveDoc returns doc', () => {
				const setup = () => {
					const doc = new Uint8Array(0);
					jest.spyOn(service, 'retrieveDoc').mockResolvedValueOnce({ doc, references: [] });

					const stateVector = new Uint8Array(1);
					jest.spyOn(Y, 'encodeStateVectorFromUpdateV2').mockReturnValueOnce(stateVector);

					return { doc, stateVector };
				};

				it('should call encodeStateVectorFromUpdateV2', async () => {
					const { doc } = setup();

					await service.retrieveStateVector('room', 'docname');

					expect(Y.encodeStateVectorFromUpdateV2).toHaveBeenCalledWith(doc);
				});

				it('should return state vector', async () => {
					const { stateVector } = setup();

					const result = await service.retrieveStateVector('room', 'docname');

					expect(result).toBe(stateVector);
				});
			});
		});
	});

	describe('deleteReferences', () => {
		describe('when removeObjects resolves', () => {
			const setup = () => {
				const storeReferences = ['ref1', 'ref2'];

				return { storeReferences };
			};

			it('should call removeObjects', async () => {
				const { storeReferences } = setup();

				await service.deleteReferences('room', 'docname', storeReferences);

				expect(client.removeObjects).toHaveBeenCalledWith(bucketName, storeReferences);
			});
		});

		describe('when removeObjects rejects', () => {
			const setup = () => {
				const error = new Error();
				client.removeObjects.mockRejectedValueOnce(error);

				return { error };
			};

			it('should throw an error', async () => {
				const { error } = setup();

				await expect(service.deleteReferences('room', 'docname', [])).rejects.toThrow(error);
			});
		});
	});

	describe('deleteDocument', () => {
		describe('when listObjectsV2 rejects', () => {
			const setup = () => {
				const error = new Error();
				const returnValue = { toArray: jest.fn().mockRejectedValueOnce(error) };
				client.listObjectsV2.mockReturnValueOnce(returnValue as unknown as BucketStream<BucketItem>);

				return { error };
			};

			it('should reject', async () => {
				const { error } = setup();

				await expect(service.deleteDocument('room', 'docname')).rejects.toThrow(error);
			});
		});

		describe('when listObjectsV2 resolves', () => {
			describe('when removeObjects resolves', () => {
				const setup = () => {
					const objNames = [{ name: 'obj1' }, { name: 'obj2' }];
					const returnValue = { toArray: jest.fn().mockResolvedValueOnce(objNames) };
					client.listObjectsV2.mockReturnValueOnce(returnValue as unknown as BucketStream<BucketItem>);

					return { objNames };
				};

				it('should call removeObjects', async () => {
					setup();

					await service.deleteDocument('room', 'docname');

					expect(client.removeObjects).toHaveBeenCalledWith(bucketName, ['obj1', 'obj2']);
				});
			});

			describe('when removeObjects rejects', () => {
				const setup = () => {
					const objNames = [{ name: 'obj1' }, { name: 'obj2' }];
					const returnValue = { toArray: jest.fn().mockResolvedValueOnce(objNames) };
					client.listObjectsV2.mockReturnValueOnce(returnValue as unknown as BucketStream<BucketItem>);

					const error = new Error();
					client.removeObjects.mockRejectedValueOnce(error);

					return { error };
				};

				it('should reject', async () => {
					const { error } = setup();

					await expect(service.deleteDocument('room', 'docname')).rejects.toThrow(error);
				});
			});
		});
	});

	describe('destroy', () => {
		it('should throw an error', () => {
			expect(() => service.destroy()).toThrow('Method not implemented.');
		});
	});
});
