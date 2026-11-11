import type { JwtPayload } from 'jsonwebtoken';
import type { QueryFilter, Types } from 'mongoose';

import { commentRepository } from '../../database/repository/comment.repository.js';
import { postRepository } from '../../database/repository/post.repository.js';
import { reportPopulate, reportRepository } from '../../database/repository/report.repository.js';
import { userRepository } from '../../database/repository/user.repository.js';
import { BadRequestException, ConflictException, NotFoundException } from '../../dependency/exception/main.exception.js';
import type { IReport } from '../../dependency/interface/database.interface.js';
import type { IHandlerResult } from '../../dependency/service/util.service.js';
import { utilService } from '../../dependency/service/util.service.js';
import { ReportStatusEnum, ReportTargetTypeEnum } from '../../dependency/value/database.enum.js';
import { SystemRoleEnum } from '../../dependency/value/security.enum.js';
import type { CreateReportBody, ListReportsQuery, ReviewReportBody } from './dto/report.dto.js';

interface ResolvedTarget {
  /** Equality filter identifying the target (used for duplicate detection). */
  key: QueryFilter<IReport>;
  /** Owner of the reported content, stored so admins can act on the account. */
  reportedUser: Types.ObjectId;
}

class ReportService {
  private notFound = () => new NotFoundException('Report not found', { messageCode: 1305 });

  /** The reporter must be able to see what they report; otherwise it doesn't exist for them. */
  private resolveTarget = async (type: ReportTargetTypeEnum, targetId: Types.ObjectId, reporter: Types.ObjectId): Promise<ResolvedTarget> => {
    const missing = () => new NotFoundException('Reported content not found', { messageCode: 1306 });

    switch (type) {
      case ReportTargetTypeEnum.USER: {
        if (targetId.equals(reporter)) throw new BadRequestException('Cannot report yourself', { messageCode: 418 });
        if (!(await userRepository.findPublicById(targetId))) throw missing();
        return { key: { reportedUser: targetId, post: { $exists: false }, comment: { $exists: false } }, reportedUser: targetId };
      }
      case ReportTargetTypeEnum.POST: {
        const post = await postRepository.findVisibleById(targetId, reporter);
        if (!post) throw missing();
        return { key: { post: targetId }, reportedUser: post.author };
      }
      case ReportTargetTypeEnum.COMMENT: {
        const comment = await commentRepository.findActiveById(targetId);
        if (!comment || !(await postRepository.findVisibleById(comment.post, reporter))) throw missing();
        return { key: { comment: targetId }, reportedUser: comment.author };
      }
    }
  };

  create = async (body: CreateReportBody, payload: JwtPayload): Promise<IHandlerResult> => {
    const reporter = utilService.currentUserId(payload);
    const targetId = utilService.toObjectId(body.targetId);
    const target = await this.resolveTarget(body.targetType, targetId, reporter);

    if (await reportRepository.findPendingDuplicate(reporter, { targetType: body.targetType, ...target.key })) {
      throw new ConflictException('Already reported', { messageCode: 1307 });
    }

    const report = await reportRepository.create({
      data: {
        reporter,
        targetType: body.targetType,
        reportedUser: target.reportedUser,
        ...(body.targetType === ReportTargetTypeEnum.POST ? { post: targetId } : {}),
        ...(body.targetType === ReportTargetTypeEnum.COMMENT ? { comment: targetId } : {}),
        reason: body.reason,
        ...(body.description ? { description: body.description } : {}),
        status: ReportStatusEnum.PENDING,
      },
    });

    return { status: 201, messageCode: 1301, data: report };
  };

  list = async (query: ListReportsQuery): Promise<IHandlerResult> => {
    const filter: QueryFilter<IReport> = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.targetType ? { targetType: query.targetType } : {}),
    };
    return { messageCode: 1302, ...utilService.paged(await reportRepository.paginateForAdmin(filter, query.page, query.size)) };
  };

  /** Admins see any report; a user sees only their own (others look missing). */
  get = async (reportId: string, payload: JwtPayload, role: SystemRoleEnum | undefined): Promise<IHandlerResult> => {
    const report = await reportRepository.findById(utilService.toObjectId(reportId), { populate: reportPopulate, lean: true });
    if (!report) throw this.notFound();

    const reporterId = String(utilService.refId(report.reporter));
    if (role !== SystemRoleEnum.ADMIN && reporterId !== payload.sub) throw this.notFound();

    return { messageCode: 1303, data: report };
  };

  review = async (reportId: string, body: ReviewReportBody, payload: JwtPayload): Promise<IHandlerResult> => {
    const report = await reportRepository.findByIdAndUpdate(utilService.toObjectId(reportId), {
      $set: { status: body.status, reviewedBy: utilService.currentUserId(payload), reviewedAt: new Date() },
    });
    if (!report) throw this.notFound();
    await report.populate(reportPopulate);
    return { messageCode: 1304, data: report };
  };
}

export const reportService = new ReportService();
