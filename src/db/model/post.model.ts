import { model, Schema, HydratedDocument } from 'mongoose';
import {
  MediaTypeEnum,
  PostVisibilityEnum,
} from '../../dep/value/database.enum.js';
import type { IPost } from '../../dep/interface/database.interface.js';

const mediaSchema = new Schema(
  {
    url: { type: String, required: true },
    type: { type: String, enum: MediaTypeEnum, required: true },
    publicId: String,
    width: Number,
    height: Number,
    duration: Number,
    size: Number,
    thumbnailUrl: String,
  },
  { _id: false }
);

const postSchema = new Schema<IPost>(
  {
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: String,
    media: {
      type: [mediaSchema],
      default: [],
    },
    visibility: {
      type: String,
      enum: PostVisibilityEnum,
      default: PostVisibilityEnum.PUBLIC,
    },
    likesCount: { type: Number, default: 0, min: 0 },
    commentsCount: { type: Number, default: 0, min: 0 },
    sharesCount: { type: Number, default: 0, min: 0 },
    commentsEnabled: { type: Boolean, default: true },
    editedAt: Date,
    deletedAt: Date,
  },
  { timestamps: true }
);

postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ visibility: 1, createdAt: -1 });

export type HPostDocument = HydratedDocument<IPost>;
export const PostModel = model<IPost>('Post', postSchema);