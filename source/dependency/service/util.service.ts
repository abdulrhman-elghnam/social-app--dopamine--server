import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';

import { languageService } from './language.service.js';
import { IError } from '../exception/app.exception.js';
import { randomInt } from 'crypto';
import { Types } from 'mongoose';

export interface IHandlerResult {
  status?: number;
  message?: string;
  messageCode?: number;
  data?: unknown;
  meta?: unknown;
}

export interface IHandlerFunction {
  handler: (req: Request, res: Response, next: NextFunction) => IHandlerResult | void | Promise<IHandlerResult | void>;
}

export class UtilService {
  constructor() {}

  createOtp = () => randomInt(100000, 1000000);

  toObjectId = (id: string) => {
    return new Types.ObjectId(id);
  };

  /** Id of the authenticated user (JWT `sub`) set by authGuard. */
  currentUserId = (payload: { sub?: string | undefined } | undefined) => new Types.ObjectId(payload?.sub as string);
  /** Id of a reference whether or not it was populated (`ObjectId` or `{ _id }`). */
  refId = (ref: Types.ObjectId | { _id: Types.ObjectId }): Types.ObjectId => (ref instanceof Types.ObjectId ? ref : ref._id);
  /** Typed subset of an object's own keys. */
  pick = <T extends object, K extends keyof T>(source: T, keys: readonly K[]): Pick<T, K> => {
    const result = {} as Pick<T, K>;
    for (const key of keys) if (key in source) result[key] = source[key];
    return result;
  };
  /** Splits a paginate() result into the `{ data, meta }` envelope the API returns. */
  paged = <D>({ data, ...meta }: { data: D[]; totalDocuments: number; totalPages: number; currentPage: number; pageSize: number }) => ({ data, meta });
  issuer = (req: Request) => `${req.protocol}://${req.host}`;
  splitFullName = (fullName: string) => {
    const [firstName, ...rest] = fullName.trim().split(/\s+/);
    return {
      firstName: firstName ?? fullName,
      lastName: rest.join(' ') || firstName || fullName,
    };
  };

  public responseFormatter = ({ handler }: IHandlerFunction) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const result = await handler(req, res, next);
        if (res.headersSent) return;
        const language = req.get('accept-language');

        const message = languageService.chooseLanguage(language, result?.messageCode ?? 107);

        res.status(result?.status ?? 200).json({
          message: result?.message ?? message,
          data: result?.data,
          meta: result?.meta,
        });
      } catch (error) {
        next(error);
      }
    };
  };

  public globalErrorHandling: ErrorRequestHandler = (error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    const statusMessageCodes: Record<number, number> = {
      400: 108,
      401: 109,
      403: 110,
      404: 111,
      405: 117,
      408: 118,
      409: 112,
      422: 113,
      429: 114,
      500: 115,
      503: 116,
    };

    const normalizedError: IError = (error instanceof Error ? error : new Error(String(error))) as IError;

    const status = normalizedError.statusCode ?? normalizedError.status;

    const statusCode = typeof status === 'number' && Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;

    const messageCode =
      typeof normalizedError.messageCode === 'number' && Number.isInteger(normalizedError.messageCode)
        ? normalizedError.messageCode
        : (statusMessageCodes[statusCode] ?? 103);

    const language = req.get('accept-language');

    const errorMessage = languageService.chooseLanguage(language, messageCode);

    return res.status(statusCode).json({
      errorMessage,
      error: normalizedError.message,
      cause: normalizedError.cause,
      stack: normalizedError.stack,
    });
  };
}

export const utilService = new UtilService();
