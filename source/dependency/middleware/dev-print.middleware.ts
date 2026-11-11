import type { RequestHandler } from 'express';
import { configService } from '../service/config.service.js';

const SENSITIVE_KEYS = /pass(word)?|token|secret|otp|authorization/i;

const redact = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, SENSITIVE_KEYS.test(key) ? '***' : redact(inner)]));
  }
  return value;
};

class DevPrintMiddleware {
  private readonly enabled = configService.get('NODE_ENV') === 'development';

  handle: RequestHandler = (req, res, next) => {
    if (!this.enabled) return next();

    res.on('finish', () => {
      const details: Record<string, unknown> = {};

      if (Object.keys(req.params ?? {}).length) details['params'] = req.params;
      if (Object.keys(req.query ?? {}).length) details['query'] = req.query;
      if (req.body && Object.keys(req.body).length) details['body'] = redact(req.body);

      console.log(`[dev] ${req.method} ${req.originalUrl} -> ${res.statusCode}`, Object.keys(details).length ? details : '');
    });

    next();
  };
}

export const devPrintMiddleware = new DevPrintMiddleware();
