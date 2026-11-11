import { model, Schema, HydratedDocument } from 'mongoose';
import { ConversationMemberRoleEnum } from '../../dependency/value/database.enum.js';
import type { IConversationMember } from '../../dependency/interface/database.interface.js';

const conversationMemberSchema = new Schema<IConversationMember>(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ConversationMemberRoleEnum,
      default: ConversationMemberRoleEnum.MEMBER,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    lastReadMessage: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
    isMuted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

conversationMemberSchema.index({ conversation: 1, user: 1 }, { unique: true });

conversationMemberSchema.index({ user: 1, updatedAt: -1 });

export type HConversationMemberDocument = HydratedDocument<IConversationMember>;

export const ConversationMemberModel = model<IConversationMember>(
  'ConversationMember',
  conversationMemberSchema
);
