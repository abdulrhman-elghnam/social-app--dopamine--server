import { Redis } from 'ioredis';
import { configService } from './config.service.js';
export const RedisKeys = {
  otpKey: (email: string) => `otp:${email.toLowerCase()}`,
  emailVerification: (email: string) => `auth:email-verification:${email.toLowerCase()}`,
  rateLimitKey: (scope: string, id: string) => `rate:${scope}:${id}`,
  userToken: (userId: string, jti: string) => `auth:token:${userId}:${jti}`,
  userTokens: (userId: string) => `auth:token:${userId}:*`,
} as const;

export interface CacheSetOptions {
  EX?: number;
  PX?: number;
  NX?: boolean;
  XX?: boolean;
}

export class CacheService {
  private readonly client: Redis;

  constructor() {
    this.client = new Redis(configService.getOrThrow('REDIS_URI'));
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const resolveConnected = () => {
        if (settled) return;
        settled = true;
        console.log({ cache: `Connected to Redis` });
        resolve();
      };
      this.client.on('ready', resolveConnected);
      this.client.on('error', (err) => {
        console.error({ cache: `Redis error: ${err}` });
        if (!settled) reject(err);
      });
      this.client.on('close', () => {
        console.log({ cache: `Redis connection closed` });
      });
      this.client.on('reconnecting', () => {
        console.log({ cache: `Reconnecting to Redis...` });
      });
      this.client.on('end', () => {
        console.log({ cache: `Redis connection ended` });
      });

      if (this.client.status === 'ready') resolveConnected();
    });
  }
  private serialize(value: unknown): string {
    const json = JSON.stringify(value);
    if (json === undefined) {
      throw new TypeError('Cannot cache undefined, functions or symbols');
    }
    return json;
  }

  private deserialize<T>(raw: string): T {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }

  async setCache<T>({
    key,
    value,
    options = {},
  }: {
    key: string;
    value: T;
    options?: CacheSetOptions;
  }): Promise<boolean> {
    const { EX, PX, NX, XX } = options;
    const ttlCount = [EX !== undefined, PX !== undefined].filter(Boolean).length;
    if (ttlCount > 1) throw new Error('EX and PX are mutually exclusive');

    const args: Array<string | number> = [];
    if (EX !== undefined) args.push('EX', EX);
    if (PX !== undefined) args.push('PX', PX);
    if (NX) args.push('NX');
    if (XX) args.push('XX');

    return (await this.client.call('SET', key, this.serialize(value), ...args)) === 'OK';
  }

  async getCache<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    return value === null ? null : this.deserialize<T>(value);
  }

  async getAndDelete<T>(key: string): Promise<T | null> {
    const value = await this.client.getdel(key);
    return value === null ? null : this.deserialize<T>(value);
  }

  async increment(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async decrement(key: string): Promise<number> {
    return this.client.decr(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    return (await this.client.expire(key, seconds)) === 1;
  }

  async timeToLive(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async deleteCache(key: string): Promise<number> {
    return this.client.del(key);
  }

  async deleteByPattern(pattern: string): Promise<number> {
    let cursor = '0';
    let deleted = 0;

    do {
      const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
      if (keys.length > 0) deleted += await this.client.unlink(...keys);
      cursor = nextCursor;
    } while (cursor !== '0');

    return deleted;
  }

  async close(): Promise<void> {
    await this.client.call('QUIT');
  }
}

export const cacheService = new CacheService();
