import type { JwtPayload } from 'jsonwebtoken';
import type { Types } from 'mongoose';

import { blockRepository } from '../../database/repository/block.repository.js';
import { notificationRepository } from '../../database/repository/notification.repository.js';
import { NotFoundException } from '../../dependency/exception/main.exception.js';
import type { IHandlerResult } from '../../dependency/service/util.service.js';
import { utilService } from '../../dependency/service/util.service.js';
import { NotificationTypeEnum } from '../../dependency/value/database.enum.js';
import { AUTHOR_FIELDS } from '../../dependency/value/projection.value.js';
import { socketGateway } from '../../realtime/socket.gateway.js';
import { SocketEvents } from '../../realtime/socket.events.js';
import type { GetNotificationsQuery } from './dto/notification.dto.js';

export interface NotifyInput {
  recipient: Types.ObjectId;
  sender: Types.ObjectId;
  type: NotificationTypeEnum;
  post?: Types.ObjectId;
  comment?: Types.ObjectId;
}

class NotificationService {
  /**
   * Persists a notification and pushes `notification:new` to the recipient's room.
   * Never notifies yourself or across a block. Failures are logged, never thrown — a
   * notification must not break the action that caused it.
   */
  notify = async (input: NotifyInput): Promise<void> => {
    try {
      if (input.recipient.equals(input.sender)) return;
      if (await blockRepository.isBlockedEither(input.recipient, input.sender)) return;

      const notification = await notificationRepository.create({ data: { ...input, isRead: false } });
      await notification.populate({ path: 'sender', select: AUTHOR_FIELDS });
      const unreadCount = await notificationRepository.unreadCount(input.recipient);

      socketGateway.emitToUser(input.recipient, SocketEvents.NOTIFICATION_NEW, { notification, unreadCount });
    } catch (error) {
      console.error('[notification] failed to notify', error);
    }
  };

  /** Removes a notification whose cause was undone (unlike, unfollow, cancelled request). */
  retract = async (input: NotifyInput): Promise<void> => {
    try {
      await notificationRepository.deleteMany({
        recipient: input.recipient,
        sender: input.sender,
        type: input.type,
        ...(input.post ? { post: input.post } : {}),
        ...(input.comment ? { comment: input.comment } : {}),
      });
    } catch (error) {
      console.error('[notification] failed to retract', error);
    }
  };

  list = async (query: GetNotificationsQuery, payload: JwtPayload): Promise<IHandlerResult> => {
    const userId = utilService.currentUserId(payload);
    const [result, unreadCount] = await Promise.all([
      notificationRepository.paginateFor(userId, query.page, query.size, query.unread),
      notificationRepository.unreadCount(userId),
    ]);
    const { data, meta } = utilService.paged(result);
    return { messageCode: 1101, data, meta: { ...meta, unreadCount } };
  };

  /** Shared by REST `PATCH /notifications/:id/read` and socket `notification:read`. */
  markRead = async (notificationId: string, userId: Types.ObjectId): Promise<number> => {
    const found = await notificationRepository.markRead(utilService.toObjectId(notificationId), userId);
    if (!found) throw new NotFoundException('Notification not found', { messageCode: 1105 });
    const unreadCount = await notificationRepository.unreadCount(userId);
    // Keep the user's other devices in sync.
    socketGateway.emitToUser(userId, SocketEvents.NOTIFICATION_READ_UPDATE, { notificationId, unreadCount });
    return unreadCount;
  };

  markReadHandler = async (notificationId: string, payload: JwtPayload): Promise<IHandlerResult> => {
    const unreadCount = await this.markRead(notificationId, utilService.currentUserId(payload));
    return { messageCode: 1102, data: { notificationId, unreadCount } };
  };

  markAllRead = async (payload: JwtPayload): Promise<IHandlerResult> => {
    const userId = utilService.currentUserId(payload);
    const updated = await notificationRepository.markAllRead(userId);
    socketGateway.emitToUser(userId, SocketEvents.NOTIFICATION_READ_UPDATE, { all: true, unreadCount: 0 });
    return { messageCode: 1103, data: { updated, unreadCount: 0 } };
  };

  remove = async (notificationId: string, payload: JwtPayload): Promise<IHandlerResult> => {
    const deleted = await notificationRepository.deleteIfPresent({
      _id: utilService.toObjectId(notificationId),
      recipient: utilService.currentUserId(payload),
    });
    if (!deleted) throw new NotFoundException('Notification not found', { messageCode: 1105 });
    return { messageCode: 1104 };
  };
}

export const notificationService = new NotificationService();
