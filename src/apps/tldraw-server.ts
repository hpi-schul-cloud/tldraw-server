import { NestFactory } from '@nestjs/core';
import { App } from 'uws';
import { Logger } from '../infra/logging/logger.mjs';
import { ServerModule } from '../modules/server/server.module.mjs';

async function bootstrap() {
  const wsPort = 3345;
  const httpPort = 3347;

  const webSocketServer = App({});
  const nestApp = await NestFactory.create(ServerModule.register(webSocketServer));
  nestApp.enableCors();

  await nestApp.init();

  const logger = await nestApp.resolve(Logger);
  logger.setContext('TLDRAW');

  webSocketServer.listen(wsPort, (t) => {
    if (t) {
      logger.log(`Websocket Server is running on port ${wsPort}`);
    }
  });

  await nestApp.listen(httpPort, () => {
    logger.log(`Server is running on port ${httpPort}`);
  });
}
bootstrap();
