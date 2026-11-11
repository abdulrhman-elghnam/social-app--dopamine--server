import type { Request, RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit, type Options, type Store } from 'express-rate-limit';
import { TooManyRequestsException } from '../exception/main.exception.js';
import { configService } from '../service/config.service.js';
import { cacheService } from '../service/cache.service.js';

interface LimiterOptions {
  name: string;
  limit: number;
  windowMinutes: number;
  skipSuccessfulRequests?: boolean;
  messageCode?: number;
  standardHeaders?: Options['standardHeaders'];
}
const createRedisStore = (prefix: string): Store => {
  let windowSeconds = 60;
  const redisKey = (key: string) => `rate-limit:${prefix}:${key}`;

  return {
    prefix,

    init(options) {
      windowSeconds = Math.ceil(options.windowMs / 1000);
    },

    async increment(key) {
      const k = redisKey(key);
      const totalHits = await cacheService.increment(k);

      let ttl = await cacheService.timeToLive(k);
      if (totalHits === 1 || ttl < 0) {
        await cacheService.expire(k, windowSeconds);
        ttl = windowSeconds;
      }

      return { totalHits, resetTime: new Date(Date.now() + ttl * 1000) };
    },

    async decrement(key) {
      const k = redisKey(key);
      if (await cacheService.exists(k)) await cacheService.decrement(k);
    },

    async resetKey(key) {
      await cacheService.deleteCache(redisKey(key));
    },
  };
};

const requestIp = (req: Request): string => req.ip ?? req.socket.remoteAddress ?? 'unknown';

export class LimiterGuard {
  constructor() {}

  generateLimiter = ({
    name,
    limit,
    windowMinutes,
    skipSuccessfulRequests = false,
    messageCode = 114,
    standardHeaders = 'draft-8',
  }: LimiterOptions): RequestHandler =>
    rateLimit({
      windowMs: windowMinutes * 60 * 1000,
      limit,
      legacyHeaders: false,
      standardHeaders,
      skipSuccessfulRequests,
      keyGenerator: (req: Request) => ipKeyGenerator(requestIp(req)),
      handler: (_req, _res, next) => next(new TooManyRequestsException('Too many requests', { messageCode })),
      store: createRedisStore(name),
    });
}

export const limiterGuard = new LimiterGuard();

const limitFor = (name: string, fallback: number): number => {
  const value = Number.parseInt(configService.get(`RATE_LIMIT_${name.toUpperCase()}`, '') ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const rateLimits = {
  global: limiterGuard.generateLimiter({ name: 'global', limit: limitFor('global', 1500), windowMinutes: 15 }),
  auth: limiterGuard.generateLimiter({ name: 'auth', limit: limitFor('auth', 20), windowMinutes: 15, skipSuccessfulRequests: true }),
  refresh: limiterGuard.generateLimiter({ name: 'refresh', limit: limitFor('refresh', 100), windowMinutes: 15 }),
  otp: limiterGuard.generateLimiter({ name: 'otp', limit: limitFor('otp', 15), windowMinutes: 15 }),
  write: limiterGuard.generateLimiter({ name: 'write', limit: limitFor('write', 300), windowMinutes: 15 }),
  upload: limiterGuard.generateLimiter({ name: 'upload', limit: limitFor('upload', 30), windowMinutes: 60 }),
};
