import { model, Schema, HydratedDocument } from 'mongoose';
import { FollowRequestStatusEnum } from '../../dep/value/database.enum.js';
import type { IFollowRequest } from '../../dep/interface/database.interface.js';

const followRequestSchema = new Schema<IFollowRequest>(
  {
    requester: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: FollowRequestStatusEnum,
      default: FollowRequestStatusEnum.PENDING,
    },
  },
  { timestamps: true }
);

followRequestSchema.index({ requester: 1, recipient: 1 }, { unique: true });
followRequestSchema.index({ recipient: 1, status: 1 });

export type HFollowRequestDocument = HydratedDocument<IFollowRequest>;
export const FollowRequestModel = model<IFollowRequest>(
  'FollowRequest',
  followRequestSchema
);