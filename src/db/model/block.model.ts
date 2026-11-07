import { model, Schema, HydratedDocument } from 'mongoose';
import type { IBlock } from '../../dep/interface/database.interface.js';

const blockSchema = new Schema<IBlock>(
  {
    blocker: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    blocked: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

blockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });

export type HBlockDocument = HydratedDocument<IBlock>;
export const BlockModel = model<IBlock>('Block', blockSchema);