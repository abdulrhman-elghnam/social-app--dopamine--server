import type { Request } from 'express';
import geoip from 'geoip-lite';
import { ipKeyGenerator, rateLimit, type Options, type Store } from 'express-rate-limit';
import { cacheService } from '../service/cache.service.js';

interface LimiterOptions {
  ttl?: number;
  message?: string;
  status?: number;
  legacyHeaders?: boolean;
  standardHeaders?: Options['standardHeaders'];
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  limit?: number;
}

const fromWhere = (ip: string) => {
  try {
    return geoip.lookup(ip);
  } catch (error) {
    console.error('GeoIP lookup error:', error);
    return null;
  }
};

const createRedisStore = (): Store => {
  let windowMs = 0;

  return {
    init(options) {
      windowMs = options.windowMs;
    },

    async increment(key) {
      const totalHits = await cacheService.increment(key);

      if (totalHits === 1) {
        await cacheService.expire(key, Math.ceil(windowMs / 1000));
      }

      const ttl = await cacheService.timeToLive(key);

      return {
        totalHits,
        resetTime: new Date(Date.now() + Math.max(ttl, 0) * 1000),
      };
    },

    async decrement(key) {
      if (await cacheService.exists(key)) {
        await cacheService.decrement(key);
      }
    },

    async resetKey(key) {
      await cacheService.deleteCache(key);
    },
  };
};

const requestIp = (req: Request): string => req.ip ?? req.socket.remoteAddress ?? 'unknown';

export class LimiterGuard {
  constructor() {}

  generateLimiter = ({
    ttl = 15,
    message = 'Too Many Requests',
    status = 429,
    legacyHeaders = false,
    standardHeaders = 'draft-8',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    limit = 1000,
  }: LimiterOptions = {}) =>
    rateLimit({
      windowMs: ttl * 60 * 1000,
      limit,

      skip: (req) => {
        const data = fromWhere(requestIp(req));
        return data?.country !== 'EG';
      },

      legacyHeaders,
      standardHeaders,
      skipSuccessfulRequests,
      skipFailedRequests,

      handler: (_req, res) => {
        return res.status(status).json({
          success: false,
          status,
          message,
        });
      },

      keyGenerator: (req: Request) => {
        const ip = ipKeyGenerator(requestIp(req));
        return `${ip}::${req.baseUrl}${req.path}`;
      },

      store: createRedisStore(),
    });
}

export const limiterGuard = new LimiterGuard();
