import { model, Schema, HydratedDocument } from 'mongoose';
import type { IComment } from '../../dep/interface/database.interface.js';

const commentSchema = new Schema<IComment>(
  {
    post: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    parentComment: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    likesCount: { type: Number, default: 0, min: 0 },
    repliesCount: { type: Number, default: 0, min: 0 },
    editedAt: Date,
    deletedAt: Date,
  },
  { timestamps: true }
);

commentSchema.index({ post: 1, parentComment: 1, createdAt: -1 });
commentSchema.index({ author: 1, createdAt: -1 });

export type HCommentDocument = HydratedDocument<IComment>;
export const CommentModel = model<IComment>('Comment', commentSchema);
