import type { RequestHandler } from 'express';

class ResponseTimeMiddleware {
  handle: RequestHandler = (_req, res, next) => {
    const start = process.hrtime.bigint();
    const writeHead = res.writeHead;

    res.writeHead = function (this: typeof res, ...args: Parameters<typeof writeHead>) {
      if (!this.headersSent) {
        const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
        this.setHeader('X-Response-Time', `${elapsedMs.toFixed(2)}ms`);
      }
      return writeHead.apply(this, args);
    } as typeof writeHead;

    next();
  };
}

export const responseTimeMiddleware = new ResponseTimeMiddleware();
