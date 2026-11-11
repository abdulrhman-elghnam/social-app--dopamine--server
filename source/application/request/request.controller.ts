import { Router } from 'express';
import type { JwtPayload } from 'jsonwebtoken';
import type { NextFunction, Request, Response, Router as RouterType } from 'express';
import { authGuard } from '../../dependency/guard/auth.guard.js';
import { utilService } from '../../dependency/service/util.service.js';
import { TokenTypeEnum } from '../../dependency/value/security.enum.js';
import { requestService } from './request.service.js';

class RequestController {
  public readonly route: RouterType;

  constructor() {
    this.route = Router({
      caseSensitive: true,
      strict: true,
      mergeParams: true,
    });
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.route.get(
      '/requests',
      authGuard.check(TokenTypeEnum.ACCESS),
      utilService.responseFormatter({
        handler: async (req: Request) => requestService.getRequests(req.payload as JwtPayload),
      })
    );

    this.route.post(
      '/requests/:requestId/accept',
      authGuard.check(TokenTypeEnum.ACCESS),
      utilService.responseFormatter({
        handler: async (req: Request) =>
          requestService.acceptRequest(
            Array.isArray(req.params['requestId'])
              ? (req.params['requestId'][0] ?? '')
              : (req.params['requestId'] ?? ''),
            req.payload as JwtPayload
          ),
      })
    );

    this.route.post(
      '/requests/:requestId/reject',
      authGuard.check(TokenTypeEnum.ACCESS),
      utilService.responseFormatter({
        handler: async (req: Request) =>
          requestService.rejectRequest(
            Array.isArray(req.params['requestId'])
              ? (req.params['requestId'][0] ?? '')
              : (req.params['requestId'] ?? ''),
            req.payload as JwtPayload
          ),
      })
    );

    this.route.delete(
      '/requests/:requestId',
      authGuard.check(TokenTypeEnum.ACCESS),
      utilService.responseFormatter({
        handler: async (req: Request, _res: Response, _next: NextFunction) =>
          requestService.deleteRequest(
            Array.isArray(req.params['requestId'])
              ? (req.params['requestId'][0] ?? '')
              : (req.params['requestId'] ?? ''),
            req.payload as JwtPayload
          ),
      })
    );
  }
}

export const requestController = new RequestController();
