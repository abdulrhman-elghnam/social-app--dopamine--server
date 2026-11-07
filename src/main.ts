import express from 'express';
import type { Application } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { fileURLToPath } from 'node:url';
import { appController } from './app.controller.js';
import { utilService } from './dep/service/util.service.js';
import { databaseService } from './dep/service/database.service.js';
import { configService } from './dep/service/config.service.js';
import { authenticationController } from './module/auth/auth.controller.js';
import { cacheService } from './dep/service/cache.service.js';
import { limiterGuard } from './dep/guard/limiter.guard.js';
import { userController } from './module/user/user.controller.js';

const app: Application = express();

app.set('trust proxy', true);
app.use(express.json());
app.use(helmet(), morgan('dev'));
app.use(
  limiterGuard.generateLimiter({
    limit: 100,
    ttl: 60 * 60 * 1000,
    message: 'Too many requests, please try again later.',
  })
);
app.use('/assets', express.static(fileURLToPath(new URL('../assets', import.meta.url))));
app.use('/authentication', authenticationController.route);
app.use('/user', userController.route);
app.use(appController.route);
app.use(utilService.globalErrorHandling);

class Server {
  constructor() {}
  public run = async () => {
    await Promise.all([databaseService.connect(), cacheService.connect()]);
    const port = configService.get('PORT');
    app.listen(port, () => {
      console.log({ server: `running on http://localhost:${port}` });
    });
  };
}

const server = new Server();
server.run();
