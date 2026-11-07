import { model, Schema, HydratedDocument } from 'mongoose';
import type { ISavedPost } from '../../dep/interface/database.interface.js';

const savedPostSchema = new Schema<ISavedPost>(
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

savedPostSchema.index({ user: 1, post: 1 }, { unique: true });
savedPostSchema.index({ user: 1, createdAt: -1 });

export type HSavedPostDocument = HydratedDocument<ISavedPost>;
export const SavedPostModel = model<ISavedPost>('SavedPost', savedPostSchema);
