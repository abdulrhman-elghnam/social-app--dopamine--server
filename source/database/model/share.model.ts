import { model, Schema, HydratedDocument } from 'mongoose';
import type { IShare } from '../../dependency/interface/database.interface.js';

const shareSchema = new Schema<IShare>(
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
    content: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

shareSchema.index({ user: 1, createdAt: -1 });
shareSchema.index({ post: 1, createdAt: -1 });

export type HShareDocument = HydratedDocument<IShare>;
export const ShareModel = model<IShare>('Share', shareSchema);
