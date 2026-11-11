import type { Types } from 'mongoose';
import { NotificationModel } from '../model/notification.model.js';
import type { INotification } from '../../dependency/interface/database.interface.js';
import { AUTHOR_FIELDS } from '../../dependency/value/projection.value.js';
import { DatabaseRepository } from './base.repository.js';
import type { AuthorCard } from '../../dependency/value/projection.value.js';

export class NotificationRepository extends DatabaseRepository<INotification> {
  constructor() {
    super(NotificationModel);
  }

  /** The user's notifications, newest first, sender populated; optionally unread only. */
  async paginateFor(recipient: Types.ObjectId, page: number, size: number, unreadOnly = false) {
    return this.paginateLean<{ sender: AuthorCard }>({
      filter: { recipient, ...(unreadOnly ? { isRead: false } : {}) },
      options: { sort: { createdAt: -1 }, populate: { path: 'sender', select: AUTHOR_FIELDS } },
      page,
      size,
    });
  }

  async unreadCount(recipient: Types.ObjectId): Promise<number> {
    return this.model.countDocuments({ recipient, isRead: false }).exec();
  }

  /** Marks one of the user's notifications read; false when it doesn't exist / isn't theirs. */
  async markRead(notificationId: Types.ObjectId, recipient: Types.ObjectId): Promise<boolean> {
    const found = await this.findOne({ filter: { _id: notificationId, recipient }, options: { select: '_id', lean: true } });
    if (!found) return false;
    await this.updateOne({ filter: { _id: notificationId, isRead: false }, data: { $set: { isRead: true, readAt: new Date() } } });
    return true;
  }

  async markAllRead(recipient: Types.ObjectId): Promise<number> {
    const result = await this.updateMany({ filter: { recipient, isRead: false }, data: { $set: { isRead: true, readAt: new Date() } } });
    return result.modifiedCount;
  }
}

export const notificationRepository = new NotificationRepository();
