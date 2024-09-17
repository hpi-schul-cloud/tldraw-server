import { NestFactory } from '@nestjs/core';
import { Logger } from '../infra/logging/logger.js';
import { MetricsModule } from '../infra/metrics/metrics.module.js';
import { ServerModule } from '../modules/server/server.module.js';

async function bootstrap(): Promise<void> {
	const httpPort = 3347;
	const nestApp = await NestFactory.create(ServerModule);
	nestApp.enableCors();
	await nestApp.init();

	const metricsPort = 9090;
	const metricsApp = await NestFactory.create(MetricsModule);

	await metricsApp.listen(metricsPort, async () => {
		const logger = await metricsApp.resolve(Logger);
		logger.setContext('METRICS');
		logger.log(`Metrics server is running on port ${metricsPort}`);
	});

	await nestApp.listen(httpPort, async () => {
		const logger = await nestApp.resolve(Logger);
		logger.setContext('TLDRAW');
		logger.log(`Server is running on port ${httpPort}`);
	});
}
bootstrap();
