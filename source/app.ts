import cors, { type CorsOptions } from 'cors';
import express from 'express';
import type { Application, RequestHandler } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { resolve } from 'node:path';
import { appController } from './app.controller.js';
import { authenticationController } from './application/authentication/authentication.controller.js';
import { conversationController } from './application/chat/conversation.controller.js';
import { commentController, postCommentController } from './application/comment/comment.controller.js';
import { followRequestController } from './application/follow-request/follow-request.controller.js';
import { notificationController } from './application/notification/notification.controller.js';
import { postController } from './application/post/post.controller.js';
import { reportController } from './application/report/report.controller.js';
import { userController } from './application/user/user.controller.js';
import { ServiceUnavailableException } from './dependency/exception/main.exception.js';
import { rateLimits } from './dependency/guard/limiter.guard.js';
import { devPrintMiddleware } from './dependency/middleware/dev-print.middleware.js';
import { maintenanceModeMiddleware } from './dependency/middleware/maintenance-mode.middleware.js';
import { responseTimeMiddleware } from './dependency/middleware/response-time.middleware.js';
import { cacheService } from './dependency/service/cache.service.js';
import { configService } from './dependency/service/config.service.js';
import { databaseService } from './dependency/service/database.service.js';
import { utilService } from './dependency/service/util.service.js';

export const isProduction = configService.get('NODE_ENV') === 'production';

export const isVercel = Boolean(configService.get('VERCEL'));

let connecting: Promise<void> | null = null;

export function connectServices(): Promise<void> {
  connecting ??= Promise.all([databaseService.connect(), cacheService.connect()])
    .then(() => undefined)
    .catch((error: unknown) => {
      connecting = null;
      throw error;
    });
  return connecting;
}

const requireServices: RequestHandler = async (_req, _res, next) => {
  try {
    await connectServices();
    next();
  } catch (error) {
    next(new ServiceUnavailableException('Service temporarily unavailable', { extra: error }));
  }
};

function trustProxySetting(): number | boolean {
  if (isVercel) return 1;
  const raw = configService.get('TRUST_PROXY', '')?.trim().toLowerCase() ?? '';
  if (raw === 'true') return true;
  const hops = Number.parseInt(raw, 10);
  return Number.isFinite(hops) && hops > 0 ? hops : false;
}

function corsOptions(): CorsOptions {
  const explicit = configService.get('CORS_ORIGINS')?.trim();
  const origins = (explicit || configService.get('FRONTEND_URL') || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return {
    // An explicit CORS_ORIGINS list applies everywhere; without one, development allows any origin.
    origin: explicit || isProduction ? origins : true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
    exposedHeaders: ['X-Response-Time', 'RateLimit', 'RateLimit-Policy', 'Retry-After'],
    maxAge: 600,
  };
}

export function createApp(): Application {
  const app = express();
  app.set('trust proxy', trustProxySetting());
  app.disable('x-powered-by');
  app.use(responseTimeMiddleware.handle);
  app.use(helmet());
  app.use(cors(corsOptions()));
  app.use(morgan(isProduction ? 'combined' : 'dev'));
  app.use(express.json({ limit: '1mb' }));
  app.use(devPrintMiddleware.handle);
  app.use(maintenanceModeMiddleware.handle);
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
  });
  app.use(requireServices);
  app.use(rateLimits.global);
  app.use('/assets', express.static(resolve('assets'), { maxAge: isProduction ? '7d' : 0, fallthrough: true }));
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

  return app;
}
