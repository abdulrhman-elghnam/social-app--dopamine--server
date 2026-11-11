import type { RequestHandler } from 'express';
import { ServiceUnavailableException } from '../exception/main.exception.js';
import { configService } from '../service/config.service.js';

class MaintenanceModeMiddleware {
  private readonly enabled = configService.get('MAINTENANCE_MODE', 'false')?.trim().toLowerCase() === 'true';
  private readonly retryAfterSeconds = 60 * 60;

  handle: RequestHandler = (_req, res, next) => {
    if (!this.enabled) return next();

    res.set('retry-after', String(this.retryAfterSeconds));
    return next(new ServiceUnavailableException('Server is under maintenance', { messageCode: 131 }));
  };
}

export const maintenanceModeMiddleware = new MaintenanceModeMiddleware();
