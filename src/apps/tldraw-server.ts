import { NestFactory } from '@nestjs/core';
import { Logger } from '../infra/logging/logger.js';
import { ServerModule } from '../modules/server/server.module.js';

async function bootstrap() {
  const httpPort = 3347;
  const nestApp = await NestFactory.create(ServerModule);
  nestApp.enableCors();

  await nestApp.init();

  const logger = await nestApp.resolve(Logger);
  logger.setContext('TLDRAW');

  await nestApp.listen(httpPort, () => {
    logger.log(`Server is running on port ${httpPort}`);
  });
}
bootstrap();
