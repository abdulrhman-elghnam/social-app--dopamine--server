import { createServer } from 'node:http';
import mongoose from 'mongoose';
import { connectServices, createApp } from './app.js';
import { cacheService } from './dependency/service/cache.service.js';
import { configService } from './dependency/service/config.service.js';
import { socketServer } from './realtime/socket.server.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function start(): Promise<void> {
  await connectServices();

  const port = Number(configService.get('PORT', '9090'));
  const httpServer = createServer(createApp());
  const io = socketServer.attach(httpServer);

  httpServer.listen(port, () => {
    console.log({ server: `running on http://localhost:${port}`, pid: process.pid });
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log({ server: `${signal} received, shutting down` });


    setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
    void io.close();
    httpServer.close(() => {
      Promise.allSettled([mongoose.connection.close(), cacheService.disconnect()]).finally(() => process.exit(0));
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (reason) => {
  console.error({ server: 'Unhandled promise rejection', reason });
});

start().catch((error: unknown) => {
  console.error({ server: 'Failed to start', error });
  process.exit(1);
});
