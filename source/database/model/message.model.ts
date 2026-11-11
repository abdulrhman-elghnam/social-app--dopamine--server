import { model, Schema, HydratedDocument } from 'mongoose';
import { MediaTypeEnum, MessageTypeEnum } from '../../dependency/value/database.enum.js';
import type { IMessage } from '../../dependency/interface/database.interface.js';

const messageMediaSchema = new Schema(
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
  { _id: false },
);

const messageSchema = new Schema<IMessage>(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: String,
    media: {
      type: [messageMediaSchema],
      default: [],
    },
    type: {
      type: String,
      enum: MessageTypeEnum,
      required: true,
    },
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
    readBy: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    deliveredTo: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    editedAt: Date,
    deletedAt: Date,
  },
  { timestamps: true },
);

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });

export type HMessageDocument = HydratedDocument<IMessage>;
export const MessageModel = model<IMessage>('Message', messageSchema);
