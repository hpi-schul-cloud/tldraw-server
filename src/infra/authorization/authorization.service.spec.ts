import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpRequest } from 'uws';
import { Logger } from '../logger/logger.js';
import { AuthorizationApi, AuthorizedReponse } from './authorization-api-client/index.js';
import { AuthorizationService } from './authorization.service.js';

describe(AuthorizationService.name, () => {
	let module: TestingModule;
	let service: AuthorizationService;
	let authorizationApi: DeepMocked<AuthorizationApi>;

	beforeAll(async () => {
		module = await Test.createTestingModule({
			providers: [
				AuthorizationService,
				{
					provide: AuthorizationApi,
					useValue: createMock<AuthorizationApi>(),
				},
				{
					provide: Logger,
					useValue: createMock<Logger>(),
				},
			],
		}).compile();

		service = module.get<AuthorizationService>(AuthorizationService);
		authorizationApi = module.get(AuthorizationApi);
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

		return { req };
	};

	describe('hasPermission', () => {
		describe('when the user request has permission', () => {
			const setup = () => {
				const { req } = setupRequest();

				const response = createMock<AuthorizedReponse>({
					isAuthorized: true,
					userId: '123',
				});
				authorizationApi.authorizationReferenceControllerAuthorizeByReference.mockResolvedValueOnce(response);

				const expectedResult = { error: null, hasWriteAccess: true, room: 'roomId', userid: '123' };

				return { req, expectedResult };
			};

			it('should return an expectedResult response payload', async () => {
				const { req, expectedResult } = setup();

				const response = await service.hasPermission(req);

				expect(response).toEqual(expectedResult);
			});
		});

		describe('when the user has no permission', () => {
			const setup = () => {
				const { req } = setupRequest();

				const response = createMock<AuthorizedReponse>({
					isAuthorized: false,
					userId: '123',
				});
				authorizationApi.authorizationReferenceControllerAuthorizeByReference.mockResolvedValueOnce(response);

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
				const { req } = setupRequest();

				const error = new Error('testError');
				authorizationApi.authorizationReferenceControllerAuthorizeByReference.mockRejectedValueOnce(error);

				const expectedResult = {
					error: {
						code: 4500,
						reason: 'testError',
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
