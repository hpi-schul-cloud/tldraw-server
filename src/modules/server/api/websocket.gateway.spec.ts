import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { TemplatedApp } from 'uWebSockets.js';
import { AuthorizationService } from '../../../infra/authorization/authorization.service.js';
import { Logger } from '../../../infra/logger/logger.js';
import { MetricsService } from '../../../infra/metrics/metrics.service.js';
import { IoRedisAdapter } from '../../../infra/redis/ioredis.adapter.js';
import { RedisService } from '../../../infra/redis/redis.service.js';
import { StorageService } from '../../../infra/storage/storage.service.js';
import * as WsService from '../../../infra/y-redis/ws.service.js';
import { registerYWebsocketServer } from '../../../infra/y-redis/ws.service.js';
import { ServerConfig } from '../server.config.js';
import { WebsocketGateway } from './websocket.gateway.js';

describe(WebsocketGateway.name, () => {
	let service: WebsocketGateway;
	let storageService: StorageService;
	let redisService: DeepMocked<RedisService>;
	let webSocketServer: DeepMocked<TemplatedApp>;
	let logger: DeepMocked<Logger>;

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
		const setup = () => {
			const yWebsocketServer = createMock<WsService.YWebsocketServer>();
			jest.spyOn(WsService, 'registerYWebsocketServer').mockResolvedValueOnce(yWebsocketServer);

			const redisAdapter: DeepMocked<IoRedisAdapter> = createMock<IoRedisAdapter>();

			return { redisAdapter };
		};

		it('should call registerYWebsocketServer', async () => {
			setup();

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

		it('should increment openConnectionsGauge on openWsCallback', async () => {
			setup();
			const openConnectionsGaugeIncSpy = jest.spyOn(MetricsService.openConnectionsGauge, 'inc');

			await service.onModuleInit();

			const openWsCallback = (registerYWebsocketServer as jest.Mock).mock.calls[0][4].openWsCallback;
			openWsCallback();

			expect(openConnectionsGaugeIncSpy).toHaveBeenCalled();
		});

		it('should decrement openConnectionsGauge on closeWsCallback', async () => {
			setup();
			const openConnectionsGaugeDecSpy = jest.spyOn(MetricsService.openConnectionsGauge, 'dec');

			await service.onModuleInit();
			const closeWsCallback = (registerYWebsocketServer as jest.Mock).mock.calls[0][4].closeWsCallback;
			closeWsCallback();

			expect(openConnectionsGaugeDecSpy).toHaveBeenCalled();
		});

		it('should call webSocketServer.listen', async () => {
			setup();
			await service.onModuleInit();

			expect(webSocketServer.listen).toHaveBeenCalledWith(3345, expect.any(Function));
		});

		it('should call redisAdapter.subscribeToDeleteChannel', async () => {
			const { redisAdapter } = setup();
			redisService.createRedisInstance.mockResolvedValueOnce(redisAdapter);

			await service.onModuleInit();

			expect(redisService.createRedisInstance).toHaveBeenCalled();
			expect(redisAdapter.subscribeToDeleteChannel).toHaveBeenCalledWith(expect.any(Function));
		});

		it('should call webSocketServer.publish', async () => {
			const { redisAdapter } = setup();

			redisService.createRedisInstance.mockResolvedValueOnce(redisAdapter);
			redisAdapter.subscribeToDeleteChannel.mockImplementation((cb) => cb('test'));

			await service.onModuleInit();

			expect(webSocketServer.publish).toHaveBeenCalledWith('test', 'action:delete');
		});

		it('should log if webSocketServer.listen return true', async () => {
			setup();
			// @ts-ignore
			webSocketServer.listen.mockImplementationOnce((_, cb) => cb(true));

			await service.onModuleInit();

			expect(logger.log).toHaveBeenCalledWith('Websocket Server is running on port 3345');
		});
	});

	describe('onModuleDestroy', () => {
		const setup = () => {
			const yWebsocketServer = createMock<WsService.YWebsocketServer>();
			jest.spyOn(WsService, 'registerYWebsocketServer').mockResolvedValueOnce(yWebsocketServer);
		};

		it('should call webSocketServer.close', () => {
			setup();
			service.onModuleDestroy();

			expect(webSocketServer.close).toHaveBeenCalled();
		});
	});
});
