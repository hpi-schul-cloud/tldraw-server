import { NestFactory } from '@nestjs/core';
import { WorkerModule } from '../modules/worker/worker.module.js';
import { WorkerService } from '../modules/worker/worker.service.js';

async function bootstrap(): Promise<void> {
	const nestApp = await NestFactory.createApplicationContext(WorkerModule);

	await nestApp.init();
	const workerService = await nestApp.resolve(WorkerService);

	try {
		workerService.start();
	} catch (error) {
		console.error(error);
		workerService.stop();
		process.exit(1);
	}
}
bootstrap();
