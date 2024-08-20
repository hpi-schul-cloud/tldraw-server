import { NestFactory } from '@nestjs/core';
import { App } from 'uws';
import { ServerModule } from '../modules/server/server.module.mjs';

async function bootstrap() {
  const wsPort = 3345;
  const httpPort = 3347;

  const webSocketServer = App({});
  const nestApp = await NestFactory.create(ServerModule.register(webSocketServer));
  nestApp.enableCors();

  await nestApp.init();
  webSocketServer.listen(wsPort, (t) => {
    if (t) {
      console.log(`TLDRAW Websocket Server is running on port ${wsPort}`);
    }
  });

  await nestApp.listen(httpPort, () => {
    console.log(`TLDRAW Server is running on port ${httpPort}`);
  });
}
bootstrap();
