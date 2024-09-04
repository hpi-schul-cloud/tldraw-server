import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpRequest } from 'uws';
import { Logger } from '../logging/logger.js';
import { AuthorizationService } from './authorization.service.js';

describe(AuthorizationService.name, () => {
	let module: TestingModule;
	let service: AuthorizationService;
	let configService: DeepMocked<ConfigService>;

	beforeAll(async () => {
		module = await Test.createTestingModule({
			providers: [
				AuthorizationService,
				{
					provide: ConfigService,
					useValue: createMock<ConfigService>(),
				},
				{
					provide: Logger,
					useValue: createMock<Logger>(),
				},
			],
		}).compile();

		service = module.get<AuthorizationService>(AuthorizationService);
		configService = module.get(ConfigService);
	});

	afterAll(async () => {
		await module.close();
	});

	afterEach(() => {
		jest.resetAllMocks();
	});

	const setupRequest = (roomId = 'roomId', cookies = 'other=ABC;jwt=eyJhbGciOiJIU') => {
		const req: DeepMocked<HttpRequest> = createMock<HttpRequest>();
		jest.spyOn(req, 'getParameter').mockReturnValue(roomId);
		jest.spyOn(req, 'getHeader').mockReturnValue(cookies);
		configService.getOrThrow.mockReturnValue('API_HOST');
		const fetchSpy = jest.spyOn(global, 'fetch');

		return { req, fetchSpy };
	};

	describe('hasPermission', () => {
		describe('when the user request has permission', () => {
			const setup = () => {
				const { req, fetchSpy } = setupRequest();

				fetchSpy.mockResolvedValue({
					ok: true,
					json: () => Promise.resolve({ isAuthorized: true, userId: '123' }),
				} as any);

				const expectedResult = { error: null, hasWriteAccess: true, room: 'roomId', userid: '123' };

				return { req, expectedResult };
			};

			it('should return an expectedResult response payload', async () => {
				const { req, expectedResult } = setup();

				const response = await service.hasPermission(req);

				expect(response).toEqual(expectedResult);
			});
		});

		describe('when the user request has not permission', () => {
			const setup = () => {
				const { req, fetchSpy } = setupRequest();

				fetchSpy.mockResolvedValue({
					ok: true,
					json: () => Promise.resolve({ isAuthorized: false, userId: '123' }),
				} as any);

				const expectedResult = {
					error: {
						code: 4401,
						reason: 'Unauthorized',
					},
					hasWriteAccess: false,
					room: null,
					userid: null,
				};

				return { req, expectedResult };
			};

			it('should return an expectedResult response payload', async () => {
				const { req, expectedResult } = setup();

				const response = await service.hasPermission(req);

				expect(response).toEqual(expectedResult);
			});
		});

		describe('when the roomId is not in request params', () => {
			const setup = () => {
				const { req } = setupRequest('');

				const expectedResult = {
					error: {
						code: 4500,
						reason: 'RoomId not found',
					},
					hasWriteAccess: false,
					room: null,
					userid: null,
				};

				return { req, expectedResult };
			};

			it('should return an expectedResult response payload', async () => {
				const { req, expectedResult } = setup();

				const response = await service.hasPermission(req);

				expect(response).toEqual(expectedResult);
			});
		});

		describe('when the jwtToken is not in request cookies', () => {
			const setup = () => {
				const { req } = setupRequest('roomId', 'other=ABC');
				const expectedResult = {
					error: {
						code: 4500,
						reason: 'JWT token not found',
					},
					hasWriteAccess: false,
					room: null,
					userid: null,
				};

				return { req, expectedResult };
			};

			it('should return an expectedResult response payload', async () => {
				const { req, expectedResult } = setup();

				const response = await service.hasPermission(req);

				expect(response).toEqual(expectedResult);
			});
		});

		describe('when the roomId not found on server', () => {
			const setup = () => {
				const { req, fetchSpy } = setupRequest();

				fetchSpy.mockResolvedValue({
					ok: false,
					status: 404,
					statusText: 'Not Found',
					json: () => Promise.resolve({}),
				} as any);

				const expectedResult = {
					error: {
						code: 4404,
						reason: 'Not Found',
					},
					hasWriteAccess: false,
					room: null,
					userid: null,
				};

				return { req, expectedResult };
			};

			it('should return an expectedResult response payload', async () => {
				const { req, expectedResult } = setup();

				const response = await service.hasPermission(req);

				expect(response).toEqual(expectedResult);
			});
		});
	});
});
