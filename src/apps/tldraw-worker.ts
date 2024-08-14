import { NestFactory } from '@nestjs/core';
import { WorkerModule } from '../modules/worker/worker.module.js';

async function bootstrap() {
  process.on('uncaughtException', (err) => {
    console.log('whoops uncaughtException! there was an error', err);
  });

  process.on('unhandledRejection', (err) => {
    console.log('whoops unhandledRejection! there was an error', err);
  });

  const nestApp = await NestFactory.createApplicationContext(WorkerModule);

  await nestApp.init();
}
bootstrap();
