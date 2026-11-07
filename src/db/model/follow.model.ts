import { model, Schema, HydratedDocument } from 'mongoose';
import type { IFollow } from '../../dep/interface/database.interface.js';

const followSchema = new Schema<IFollow>(
  {
    follower: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    following: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

followSchema.index({ follower: 1, following: 1 }, { unique: true });
followSchema.index({ following: 1, createdAt: -1 });

export type HFollowDocument = HydratedDocument<IFollow>;
export const FollowModel = model<IFollow>('Follow', followSchema);
