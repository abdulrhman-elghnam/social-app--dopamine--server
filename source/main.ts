import express from 'express';
import type { Application } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { resolve } from 'node:path';
import { appController } from './app.controller.js';
import { createServer } from 'node:http';
import { authenticationController } from './application/authentication/authentication.controller.js';
import { userController } from './application/user/user.controller.js';
import { followRequestController } from './application/follow-request/follow-request.controller.js';
import { postController } from './application/post/post.controller.js';
import { commentController, postCommentController } from './application/comment/comment.controller.js';
import { notificationController } from './application/notification/notification.controller.js';
import { conversationController } from './application/chat/conversation.controller.js';
import { reportController } from './application/report/report.controller.js';
import { socketServer } from './realtime/socket.server.js';
import { limiterGuard } from './dependency/guard/limiter.guard.js';
import { utilService } from './dependency/service/util.service.js';
import { databaseService } from './dependency/service/database.service.js';
import { cacheService } from './dependency/service/cache.service.js';
import { configService } from './dependency/service/config.service.js';
import { responseTimeMiddleware } from './dependency/middleware/response-time.middleware.js';
import { maintenanceModeMiddleware } from './dependency/middleware/maintenance-mode.middleware.js';
import { devPrintMiddleware } from './dependency/middleware/dev-print.middleware.js';

const app: Application = express();

app.set('trust proxy', true);
app.use(responseTimeMiddleware.handle);
app.use(express.json());
app.use(helmet(), morgan('dev'));
app.use(devPrintMiddleware.handle);
app.use(maintenanceModeMiddleware.handle);
app.use(
  limiterGuard.generateLimiter({
    limit: 100,
    ttl: 60 * 60 * 1000,
    message: 'Too many requests, please try again later.',
  }),
);
// Uploads are stored as `assets/<folder>/<file>` (relative to the cwd) and served at `/<that path>`.
app.use('/assets', express.static(resolve('assets')));
app.use('/auth', authenticationController.route);
app.use('/users', userController.route);
app.use('/follow-requests', followRequestController.route);
app.use('/posts/:postId/comments', postCommentController.route);
app.use('/posts', postController.route);
app.use('/comments', commentController.route);
app.use('/notifications', notificationController.route);
app.use('/conversations', conversationController.route);
app.use('/reports', reportController.route);
app.use(appController.route);
app.use(utilService.globalErrorHandling);

class Server {
  constructor() {}
  public run = async () => {
    await Promise.all([databaseService.connect(), cacheService.connect()]);
    const port = configService.get('PORT');
    const httpServer = createServer(app);
    socketServer.attach(httpServer);
    httpServer.listen(port, () => {
      console.log({ server: `running on http://localhost:${port}` });
    });
  };
}
const server = new Server();
server.run();
