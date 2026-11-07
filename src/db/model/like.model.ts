import { model, Schema, HydratedDocument } from 'mongoose';
import type { ILike } from '../../dep/interface/database.interface.js';

const likeSchema = new Schema<ILike>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    post: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

likeSchema.index({ user: 1, post: 1 }, { unique: true });
likeSchema.index({ post: 1, createdAt: -1 });

export type HLikeDocument = HydratedDocument<ILike>;
export const LikeModel = model<ILike>('Like', likeSchema);
