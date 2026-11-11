import { model, Schema, HydratedDocument } from 'mongoose';
import type { IConversation } from '../../dependency/interface/database.interface.js';

const conversationSchema = new Schema<IConversation>(
  {
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
    isGroup: { type: Boolean, default: false },
    groupName: String,
    groupImage: String,
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    admins: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true },
);

conversationSchema.index({ participants: 1, updatedAt: -1 });

export type HConversationDocument = HydratedDocument<IConversation>;
export const ConversationModel = model<IConversation>('Conversation', conversationSchema);
