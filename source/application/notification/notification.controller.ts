import { Router } from 'express';
import type { Request, Router as RouterType } from 'express';
import type { JwtPayload } from 'jsonwebtoken';

import { authGuard } from '../../dependency/guard/auth.guard.js';
import { validationPipe } from '../../dependency/pipe/validation.pipe.js';
import { utilService } from '../../dependency/service/util.service.js';
import { TokenTypeEnum } from '../../dependency/value/security.enum.js';
import { GetNotificationsDTO, NotificationIdDTO, type GetNotificationsQuery, type NotificationIdParams } from './dto/notification.dto.js';
import { notificationService } from './notification.service.js';

/** Mounted at `/notifications`. */
class NotificationController {
  public readonly route: RouterType = Router({ caseSensitive: true, strict: true });

  constructor() {
    const auth = authGuard.check(TokenTypeEnum.ACCESS);

    this.route.get(
      '/',
      auth,
      validationPipe.schema(GetNotificationsDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) => notificationService.list(req.validated!.query as GetNotificationsQuery, req.payload as JwtPayload),
      }),
    );

    // Before `/:id/read`'s sibling `/:id` routes so "read-all" is never parsed as an id.
    this.route.patch(
      '/read-all',
      auth,
      utilService.responseFormatter({
        handler: (req: Request) => notificationService.markAllRead(req.payload as JwtPayload),
      }),
    );

    this.route.patch(
      '/:id/read',
      auth,
      validationPipe.schema(NotificationIdDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) => notificationService.markReadHandler((req.validated!.params as NotificationIdParams).id, req.payload as JwtPayload),
      }),
    );

    this.route.delete(
      '/:id',
      auth,
      validationPipe.schema(NotificationIdDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) => notificationService.remove((req.validated!.params as NotificationIdParams).id, req.payload as JwtPayload),
      }),
    );
  }
}

export const notificationController = new NotificationController();
