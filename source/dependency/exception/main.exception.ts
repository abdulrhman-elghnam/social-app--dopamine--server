import { AppError, IAppErrorOptions } from './app.exception.js';

export class BadRequestException extends AppError {
  constructor(message = 'Bad request', options: IAppErrorOptions = {}) {
    super(message, { statusCode: 400, ...options });
  }
}

export class UnauthorizedException extends AppError {
  constructor(message = 'Unauthorized', options: IAppErrorOptions = {}) {
    super(message, { statusCode: 401, ...options });
  }
}

export class ForbiddenException extends AppError {
  constructor(message = 'Forbidden', options: IAppErrorOptions = {}) {
    super(message, { statusCode: 403, ...options });
  }
}

export class NotFoundException extends AppError {
  constructor(message = 'Resource not found', options: IAppErrorOptions = {}) {
    super(message, { statusCode: 404, ...options });
  }
}

export class ConflictException extends AppError {
  constructor(message = 'Conflict', options: IAppErrorOptions = {}) {
    super(message, { statusCode: 409, ...options });
  }
}

export class UnprocessableEntityException extends AppError {
  constructor(message = 'Unprocessable entity', options: IAppErrorOptions = {}) {
    super(message, { statusCode: 422, ...options });
  }
}

export class TooManyRequestsException extends AppError {
  constructor(message = 'Too many requests', options: IAppErrorOptions = {}) {
    super(message, { statusCode: 429, ...options });
  }
}

export class InternalServerErrorException extends AppError {
  constructor(message = 'Internal server error', options: IAppErrorOptions = {}) {
    super(message, { statusCode: 500, ...options });
  }
}

export class ServiceUnavailableException extends AppError {
  constructor(message = 'Service unavailable', options: IAppErrorOptions = {}) {
    super(message, { statusCode: 503, ...options });
  }
}
