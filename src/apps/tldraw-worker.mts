import { NestFactory } from '@nestjs/core';
import { WorkerModule } from '../modules/worker/worker.module.mjs';

async function bootstrap() {
  const nestApp = await NestFactory.createApplicationContext(WorkerModule);

  await nestApp.init();
}
bootstrap();
