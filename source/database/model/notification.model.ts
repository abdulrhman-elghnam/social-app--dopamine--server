import { model, Schema, HydratedDocument } from 'mongoose';
import { NotificationTypeEnum } from '../../dependency/value/database.enum.js';
import type { INotification } from '../../dependency/interface/database.interface.js';

const notificationSchema = new Schema<INotification>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: NotificationTypeEnum,
      required: true,
    },
    post: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
    },
    comment: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
    },
    isRead: { type: Boolean, default: false },
    readAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

export type HNotificationDocument = HydratedDocument<INotification>;
export const NotificationModel = model<INotification>('Notification', notificationSchema);
