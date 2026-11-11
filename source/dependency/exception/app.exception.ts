export interface IAppErrorOptions {
  statusCode?: number;
  messageCode?: number;
  extra?: unknown;
}

export interface IError extends Error {
  status?: unknown;
  statusCode?: unknown;
  messageCode?: unknown;
}

export class AppError extends Error {
  readonly statusCode: number;
  readonly messageCode: number | undefined;
  readonly extra: unknown;
  readonly isOperational = true;

  constructor(message = 'Internal server error', options: IAppErrorOptions = {}) {
    super(message);

    this.name = new.target.name;
    this.statusCode = options.statusCode ?? 500;
    this.messageCode = options.messageCode;
    this.extra = options.extra;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace?.(this, new.target);
  }
}
