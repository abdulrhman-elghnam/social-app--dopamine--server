import { Router } from 'express';
import type { Request, Router as RouterType } from 'express';
import type { JwtPayload } from 'jsonwebtoken';

import { authGuard } from '../../dependency/guard/auth.guard.js';
import { roleGuard } from '../../dependency/guard/role.guard.js';
import { rateLimits } from '../../dependency/guard/limiter.guard.js';
import { validationPipe } from '../../dependency/pipe/validation.pipe.js';
import { utilService } from '../../dependency/service/util.service.js';
import { SystemRoleEnum, TokenTypeEnum } from '../../dependency/value/security.enum.js';
import {
  CreateReportDTO,
  ListReportsDTO,
  ReportIdDTO,
  ReviewReportDTO,
  type CreateReportBody,
  type ListReportsQuery,
  type ReportIdParams,
  type ReviewReportBody,
} from './dto/report.dto.js';
import { reportService } from './report.service.js';

class ReportController {
  public readonly route: RouterType = Router({ caseSensitive: true, strict: true });

  constructor() {
    const auth = authGuard.check(TokenTypeEnum.ACCESS);
    const adminOnly = roleGuard.access([SystemRoleEnum.ADMIN]);
    const reportId = (req: Request) => (req.validated!.params as ReportIdParams).id;

    this.route.post(
      '/',
      auth,
      rateLimits.write,
      validationPipe.schema(CreateReportDTO.schema),
      utilService.responseFormatter({ handler: (req: Request) => reportService.create(req.validated!.body as CreateReportBody, req.payload as JwtPayload) }),
    );

    this.route.get(
      '/',
      auth,
      adminOnly,
      validationPipe.schema(ListReportsDTO.schema),
      utilService.responseFormatter({ handler: (req: Request) => reportService.list(req.validated!.query as ListReportsQuery) }),
    );

    this.route.get(
      '/:id',
      auth,
      validationPipe.schema(ReportIdDTO.schema),
      utilService.responseFormatter({ handler: (req: Request) => reportService.get(reportId(req), req.payload as JwtPayload, req.user?.role) }),
    );

    this.route.patch(
      '/:id/review',
      auth,
      adminOnly,
      validationPipe.schema(ReviewReportDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) => reportService.review(reportId(req), req.validated!.body as ReviewReportBody, req.payload as JwtPayload),
      }),
    );
  }
}

export const reportController = new ReportController();
