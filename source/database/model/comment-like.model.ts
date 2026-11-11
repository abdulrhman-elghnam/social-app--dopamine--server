import { model, Schema, HydratedDocument } from 'mongoose';
import type { ICommentLike } from '../../dependency/interface/database.interface.js';

const commentLikeSchema = new Schema<ICommentLike>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    comment: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

commentLikeSchema.index({ user: 1, comment: 1 }, { unique: true });
commentLikeSchema.index({ comment: 1, createdAt: -1 });

export type HCommentLikeDocument = HydratedDocument<ICommentLike>;
export const CommentLikeModel = model<ICommentLike>('CommentLike', commentLikeSchema);
