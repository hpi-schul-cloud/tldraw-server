/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger as WinstonLogger } from 'winston';
import { RequestLoggingBody } from './interfaces/logger.interface.js';
import { Logger } from './logger.js';

describe('Logger', () => {
	let service: Logger;
	let processStdoutWriteSpy: jest.SpyInstance<
		boolean,
		[str: string | Uint8Array, encoding?: BufferEncoding | undefined, cb?: ((err?: Error) => void) | undefined],
		unknown
	>;
	let processStderrWriteSpy: jest.SpyInstance<
		boolean,
		[str: string | Uint8Array, encoding?: BufferEncoding | undefined, cb?: ((err?: Error) => void) | undefined],
		unknown
	>;
	let winstonLogger: DeepMocked<WinstonLogger>;

	beforeAll(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				Logger,
				{
					provide: WINSTON_MODULE_PROVIDER,
					useValue: createMock<WinstonLogger>(),
				},
			],
		}).compile();

		service = await module.resolve(Logger);
		winstonLogger = module.get(WINSTON_MODULE_PROVIDER);
	});

	beforeEach(() => {
		processStdoutWriteSpy = jest.spyOn(process.stdout, 'write');
		processStderrWriteSpy = jest.spyOn(process.stderr, 'write');
	});

	afterEach(() => {
		processStdoutWriteSpy.mockRestore();
		processStderrWriteSpy.mockRestore();
	});

	describe('WHEN log logging', () => {
		it('should call winstonLogger.info', () => {
			const error = new Error('custom error');
			service.log(error.message, error.stack);
			expect(winstonLogger.info).toHaveBeenCalled();
		});
	});

	describe('WHEN warn logging', () => {
		it('should call winstonLogger.warning', () => {
			const error = new Error('custom error');
			service.warn(error.message, error.stack);
			expect(winstonLogger.warning).toHaveBeenCalled();
		});
	});

	describe('WHEN debug logging', () => {
		it('should call winstonLogger.debug', () => {
			const error = new Error('custom error');
			service.debug(error.message, error.stack);
			expect(winstonLogger.debug).toHaveBeenCalled();
		});
	});

	describe('WHEN http logging', () => {
		it('should call winstonLogger.notice', () => {
			const error = new Error('custom error');
			const message: RequestLoggingBody = {
				userId: '123',
				request: {
					url: 'http://localhost',
					method: 'GET',
					params: { id: '1' },
					query: { page: '1' },
				},
				error,
			};
			service.http(message, error.stack);
			expect(winstonLogger.notice).toHaveBeenCalled();
		});
	});
});
