import { model, Schema, HydratedDocument } from 'mongoose';
import type { IStoryView } from '../../dependency/interface/database.interface.js';

const storyViewSchema = new Schema<IStoryView>(
  {
    story: {
      type: Schema.Types.ObjectId,
      ref: 'Story',
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    viewedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

storyViewSchema.index({ story: 1, user: 1 }, { unique: true });

export type HStoryViewDocument = HydratedDocument<IStoryView>;
export const StoryViewModel = model<IStoryView>('StoryView', storyViewSchema);
