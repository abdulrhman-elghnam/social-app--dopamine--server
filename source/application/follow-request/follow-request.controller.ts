import { Router } from 'express';
import type { Request, Router as RouterType } from 'express';
import type { JwtPayload } from 'jsonwebtoken';

import { authGuard } from '../../dependency/guard/auth.guard.js';
import { validationPipe } from '../../dependency/pipe/validation.pipe.js';
import { utilService } from '../../dependency/service/util.service.js';
import { TokenTypeEnum } from '../../dependency/value/security.enum.js';
import {
  FollowRequestIdDTO,
  ListFollowRequestsDTO,
  SendFollowRequestDTO,
  type FollowRequestIdParams,
  type ListFollowRequestsQuery,
  type SendFollowRequestParams,
} from './dto/follow-request.dto.js';
import { followRequestService } from './follow-request.service.js';

/** Mounted at `/follow-requests`. */
class FollowRequestController {
  public readonly route: RouterType = Router({ caseSensitive: true, strict: true });

  constructor() {
    const auth = authGuard.check(TokenTypeEnum.ACCESS);

    // Static paths first so they are not captured by `/:requestId`.
    this.route.get(
      '/received',
      auth,
      validationPipe.schema(ListFollowRequestsDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) => followRequestService.list('received', req.validated!.query as ListFollowRequestsQuery, req.payload as JwtPayload),
      }),
    );

    this.route.get(
      '/sent',
      auth,
      validationPipe.schema(ListFollowRequestsDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) => followRequestService.list('sent', req.validated!.query as ListFollowRequestsQuery, req.payload as JwtPayload),
      }),
    );

    this.route.post(
      '/:userId',
      auth,
      validationPipe.schema(SendFollowRequestDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) => followRequestService.send((req.validated!.params as SendFollowRequestParams).userId, req.payload as JwtPayload),
      }),
    );

    this.route.patch(
      '/:requestId/accept',
      auth,
      validationPipe.schema(FollowRequestIdDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) => followRequestService.accept((req.validated!.params as FollowRequestIdParams).requestId, req.payload as JwtPayload),
      }),
    );

    this.route.patch(
      '/:requestId/reject',
      auth,
      validationPipe.schema(FollowRequestIdDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) => followRequestService.reject((req.validated!.params as FollowRequestIdParams).requestId, req.payload as JwtPayload),
      }),
    );

    this.route.delete(
      '/:requestId',
      auth,
      validationPipe.schema(FollowRequestIdDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) => followRequestService.cancel((req.validated!.params as FollowRequestIdParams).requestId, req.payload as JwtPayload),
      }),
    );
  }
}

export const followRequestController = new FollowRequestController();
