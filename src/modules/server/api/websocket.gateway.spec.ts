import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { RedisAdapter } from 'infra/redis/interfaces/redis-adapter.js';
import { TemplatedApp } from 'uWebSockets.js';
import { AuthorizationService } from '../../../infra/authorization/authorization.service.js';
import { Logger } from '../../../infra/logger/logger.js';
import { MetricsService } from '../../../infra/metrics/metrics.service.js';
import { SubscriberService } from '../../../infra/y-redis/subscriber.service.js';
import { YRedisClient } from '../../../infra/y-redis/y-redis.client.js';
import { REDIS_FOR_SUBSCRIBE_OF_DELETION, UWS } from '../server.const.js';
import { TldrawServerConfig } from '../tldraw-server.config.js';
import { WebsocketGateway } from './websocket.gateway.js';

describe(WebsocketGateway.name, () => {
	let service: WebsocketGateway;
	let redisAdapter: DeepMocked<RedisAdapter>;
	let webSocketServer: DeepMocked<TemplatedApp>;
	let logger: DeepMocked<Logger>;

	beforeAll(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				WebsocketGateway,
				{
					provide: UWS,
					useValue: createMock<TemplatedApp>(),
				},
				{
					provide: SubscriberService,
					useValue: createMock<SubscriberService>(),
				},
				{
					provide: YRedisClient,
					useValue: createMock<YRedisClient>(),
				},
				{
					provide: AuthorizationService,
					useValue: createMock<AuthorizationService>(),
				},
				{
					provide: REDIS_FOR_SUBSCRIBE_OF_DELETION,
					useValue: createMock<RedisAdapter>(),
				},
				{
					provide: Logger,
					useValue: createMock<Logger>(),
				},
				{
					provide: TldrawServerConfig,
					useValue: {
						TLDRAW_WEBSOCKET_PATH: 'tests',
						TLDRAW_WEBSOCKET_PORT: 3345,
					},
				},
			],
		}).compile();

		service = await module.resolve(WebsocketGateway);
		redisAdapter = module.get(REDIS_FOR_SUBSCRIBE_OF_DELETION);
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

			/*expect(registerYWebsocketServer).toHaveBeenCalledWith(
				webSocketServer,
				'tests/:room',
				storageService,
				expect.any(Function),
				{
					openWsCallback: expect.any(Function),
					closeWsCallback: expect.any(Function),
				},
				redisAdapter,
			);*/
		});

		it('should increment openConnectionsGauge on openWsCallback', async () => {
			const openConnectionsGaugeIncSpy = jest.spyOn(MetricsService.openConnectionsGauge, 'inc');

			await service.onModuleInit();

			//	const openWsCallback = (registerYWebsocketServer as jest.Mock).mock.calls[0][4].openWsCallback;
			//	openWsCallback();

			expect(openConnectionsGaugeIncSpy).toHaveBeenCalled();
		});

		it('should decrement openConnectionsGauge on closeWsCallback', async () => {
			const openConnectionsGaugeDecSpy = jest.spyOn(MetricsService.openConnectionsGauge, 'dec');

			await service.onModuleInit();
			// closeWsCallback = (registerYWebsocketServer as jest.Mock).mock.calls[0][4].closeWsCallback;
			//closeWsCallback();

			expect(openConnectionsGaugeDecSpy).toHaveBeenCalled();
		});

		it('should call webSocketServer.listen', async () => {
			await service.onModuleInit();

			expect(webSocketServer.listen).toHaveBeenCalledWith(3345, expect.any(Function));
		});

		it('should call redisAdapter.subscribeToDeleteChannel', async () => {
			await service.onModuleInit();

			expect(redisAdapter.subscribeToDeleteChannel).toHaveBeenCalledWith(expect.any(Function));
		});

		it('should call webSocketServer.publish', async () => {
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

	/*describe('onModuleDestroy', () => {
		const setup = () => {
			const yWebsocketServer = createMock<WsService.YWebsocketServer>();
			jest.spyOn(WsService, 'registerYWebsocketServer').mockResolvedValueOnce(yWebsocketServer);
		};

		it('should call webSocketServer.close', () => {
			setup();
			service.onModuleDestroy();

			expect(webSocketServer.close).toHaveBeenCalled();
		});
	});*/
});
