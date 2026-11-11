import type { Types } from 'mongoose';
import { MessageModel } from '../model/message.model.js';
import type { IMessage } from '../../dependency/interface/database.interface.js';
import { AUTHOR_FIELDS, type AuthorCard } from '../../dependency/value/projection.value.js';
import type { MessagePreview } from './conversation.repository.js';
import { DatabaseRepository } from './base.repository.js';

export class MessageRepository extends DatabaseRepository<IMessage> {
  constructor() {
    super(MessageModel);
  }

  async paginateByConversation(conversation: Types.ObjectId, page: number, size: number) {
    return this.paginateLean<{ sender: AuthorCard; replyTo: MessagePreview | null }>({
      filter: { conversation },
      options: {
        sort: { createdAt: -1 },
        populate: [
          { path: 'sender', select: AUTHOR_FIELDS },
          { path: 'replyTo', select: 'sender content type deletedAt' },
        ],
      },
      page,
      size,
    });
  }

  async countUnread(conversation: Types.ObjectId, userId: Types.ObjectId, after?: Date): Promise<number> {
    return this.model
      .countDocuments({ conversation, sender: { $ne: userId }, deletedAt: { $exists: false }, ...(after ? { createdAt: { $gt: after } } : {}) })
      .exec();
  }

  async markReadUpTo(conversation: Types.ObjectId, userId: Types.ObjectId, upTo: Date): Promise<void> {
    await this.updateMany({
      filter: { conversation, sender: { $ne: userId }, createdAt: { $lte: upTo } },
      data: { $addToSet: { readBy: userId, deliveredTo: userId } },
    });
  }

  async markDelivered(messageId: Types.ObjectId, userIds: Types.ObjectId[]): Promise<void> {
    if (!userIds.length) return;
    await this.updateOne({ filter: { _id: messageId }, data: { $addToSet: { deliveredTo: { $each: userIds } } } });
  }
}

export const messageRepository = new MessageRepository();
