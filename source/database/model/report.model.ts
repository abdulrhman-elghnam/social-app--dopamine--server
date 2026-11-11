import { model, Schema, HydratedDocument } from 'mongoose';
import { ReportStatusEnum, ReportTargetTypeEnum } from '../../dependency/value/database.enum.js';
import type { IReport } from '../../dependency/interface/database.interface.js';

const reportSchema = new Schema<IReport>(
  {
    reporter: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetType: {
      type: String,
      enum: ReportTargetTypeEnum,
      required: true,
    },
    reportedUser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    post: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
    },
    comment: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    description: String,
    status: {
      type: String,
      enum: ReportStatusEnum,
      default: ReportStatusEnum.PENDING,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: Date,
  },
  { timestamps: true },
);

reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ reporter: 1, createdAt: -1 });

export type HReportDocument = HydratedDocument<IReport>;
export const ReportModel = model<IReport>('Report', reportSchema);
