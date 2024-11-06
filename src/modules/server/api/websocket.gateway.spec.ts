import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { TemplatedApp } from 'uws';
import { AuthorizationService } from '../../../infra/authorization/authorization.service.js';
import { Logger } from '../../../infra/logger/logger.js';
import { IoRedisAdapter } from '../../../infra/redis/ioredis.adapter.js';
import { RedisService } from '../../../infra/redis/redis.service.js';
import { StorageService } from '../../../infra/storage/storage.service.js';
import { registerYWebsocketServer } from '../../../infra/y-redis/ws.service.js';
import { ServerConfig } from '../server.config.js';
import { WebsocketGateway } from './websocket.gateway.js';

jest.mock('../../../infra/y-redis/ws.service.js', () => {
	return {
		registerYWebsocketServer: jest.fn(),
	};
});

describe(WebsocketGateway.name, () => {
	let service: WebsocketGateway;
	let storageService: StorageService;
	let redisService: DeepMocked<RedisService>;
	let webSocketServer: DeepMocked<TemplatedApp>;
	let logger: DeepMocked<Logger>;
	const redisAdapter: DeepMocked<IoRedisAdapter> = createMock<IoRedisAdapter>();

	beforeAll(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				WebsocketGateway,
				{
					provide: 'UWS',
					useValue: createMock<TemplatedApp>(),
				},
				{
					provide: StorageService,
					useValue: createMock<StorageService>(),
				},
				{
					provide: AuthorizationService,
					useValue: createMock<AuthorizationService>(),
				},
				{
					provide: RedisService,
					useValue: createMock<RedisService>(),
				},
				{
					provide: Logger,
					useValue: createMock<Logger>(),
				},
				{
					provide: ServerConfig,
					useValue: {
						WS_PATH_PREFIX: 'tests',
						WS_PORT: 3345,
					},
				},
			],
		}).compile();

		service = await module.resolve(WebsocketGateway);
		storageService = module.get(StorageService);
		redisService = module.get(RedisService);
		webSocketServer = module.get('UWS');
		logger = module.get(Logger);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('onModuleInit', () => {
		it('should call registerYWebsocketServer', async () => {
			await service.onModuleInit();
			expect(registerYWebsocketServer).toHaveBeenCalledWith(
				webSocketServer,
				'tests/:room',
				storageService,
				expect.any(Function),
				{
					openWsCallback: expect.any(Function),
					closeWsCallback: expect.any(Function),
				},
				redisService,
			);
		});

		it('should call webSocketServer.listen', async () => {
			await service.onModuleInit();

			expect(webSocketServer.listen).toHaveBeenCalledWith(3345, expect.any(Function));
		});

		it('should call redisAdapter.subscribeToDeleteChannel', async () => {
			redisService.createRedisInstance.mockResolvedValueOnce(redisAdapter);

			await service.onModuleInit();

			expect(redisService.createRedisInstance).toHaveBeenCalled();
			expect(redisAdapter.subscribeToDeleteChannel).toHaveBeenCalledWith(expect.any(Function));
		});

		it('should call webSocketServer.publish', async () => {
			redisService.createRedisInstance.mockResolvedValueOnce(redisAdapter);
			redisAdapter.subscribeToDeleteChannel.mockImplementation((cb) => cb('test'));

			await service.onModuleInit();

			expect(webSocketServer.publish).toHaveBeenCalledWith('test', 'action:delete');
		});

		it('should log if webSocketServer.listen return true', async () => {
			// @ts-ignore
			webSocketServer.listen.mockImplementationOnce((_, cb) => cb(true));

			await service.onModuleInit();

			expect(logger.log).toHaveBeenCalledWith('Websocket Server is running on port 3345');
		});
	});

	describe('onModuleDestroy', () => {
		it('should call webSocketServer.close', () => {
			service.onModuleDestroy();

			expect(webSocketServer.close).toHaveBeenCalled();
		});
	});
});