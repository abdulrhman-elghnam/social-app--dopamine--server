import type { QueryFilter, Types } from 'mongoose';
import { ReportModel } from '../model/report.model.js';
import type { IReport } from '../../dependency/interface/database.interface.js';
import { ReportStatusEnum } from '../../dependency/value/database.enum.js';
import { AUTHOR_FIELDS, type AuthorCard } from '../../dependency/value/projection.value.js';
import { DatabaseRepository, type Populated } from './base.repository.js';

/** A report with every reference populated (`post` / `comment` absent for other target types). */
export type PopulatedReport = Populated<
  IReport,
  {
    reporter: AuthorCard;
    reportedUser?: AuthorCard;
    reviewedBy?: AuthorCard;
    post?: { _id: Types.ObjectId; author: Types.ObjectId; content?: string };
    comment?: { _id: Types.ObjectId; author: Types.ObjectId; post: Types.ObjectId; content: string };
  }
>;

export const reportPopulate = [
  { path: 'reporter', select: AUTHOR_FIELDS },
  { path: 'reportedUser', select: AUTHOR_FIELDS },
  { path: 'reviewedBy', select: AUTHOR_FIELDS },
  { path: 'post', select: 'author content visibility deletedAt createdAt' },
  { path: 'comment', select: 'author post content deletedAt createdAt' },
];

export class ReportRepository extends DatabaseRepository<IReport> {
  constructor() {
    super(ReportModel);
  }

  /** A still-pending report by the same reporter about the same target, or null. */
  async findPendingDuplicate(reporter: Types.ObjectId, target: QueryFilter<IReport>) {
    return this.findOne({ filter: { reporter, status: ReportStatusEnum.PENDING, ...target }, options: { select: '_id', lean: true } });
  }

  async paginateForAdmin(filter: QueryFilter<IReport>, page: number, size: number) {
    return this.paginateLean<PopulatedReport>({ filter, options: { sort: { createdAt: -1 }, populate: reportPopulate }, page, size });
  }
}

export const reportRepository = new ReportRepository();
