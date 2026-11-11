import express from 'express';
import type { Application } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { fileURLToPath } from 'node:url';
import { appController } from './app.controller.js';
import { authenticationController } from './application/authentication/authentication.controller.js';
import { userController } from './application/user/user.controller.js';
import { requestController } from './application/request/request.controller.js';
import { postController } from './application/post/post.controller.js';
import { commentController } from './application/comment/comment.controller.js';
import { limiterGuard } from './dependency/guard/limiter.guard.js';
import { utilService } from './dependency/service/util.service.js';
import { databaseService } from './dependency/service/database.service.js';
import { cacheService } from './dependency/service/cache.service.js';
import { configService } from './dependency/service/config.service.js';

const app: Application = express();

app.set('trust proxy', true);
app.use(express.json());
app.use(helmet(), morgan('dev'));
app.use(
  limiterGuard.generateLimiter({
    limit: 100,
    ttl: 60 * 60 * 1000,
    message: 'Too many requests, please try again later.',
  }),
);
app.use('/assets', express.static(fileURLToPath(new URL('../assets', import.meta.url))));
app.use('/authentication', authenticationController.route);
app.use('/user', userController.route);
app.use('/request', requestController.route);
app.use('/post/:postId/comment', commentController.route);
app.use('/post', postController.route);
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
