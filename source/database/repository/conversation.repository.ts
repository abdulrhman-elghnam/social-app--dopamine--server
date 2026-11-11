import type { Types } from 'mongoose';
import { ConversationModel } from '../model/conversation.model.js';
import type { IConversation, IMessage } from '../../dependency/interface/database.interface.js';
import { AUTHOR_FIELDS, type AuthorCard } from '../../dependency/value/projection.value.js';
import { DatabaseRepository, type Populated } from './base.repository.js';

/** A message as populated into `conversation.lastMessage` (and `message.replyTo`). */
export type MessagePreview = Pick<IMessage, 'sender' | 'content' | 'type' | 'createdAt' | 'deletedAt'> & { _id: Types.ObjectId };
export type ConversationListItem = Populated<IConversation, { participants: AuthorCard[]; lastMessage: MessagePreview | null }>;

export const conversationPopulate = [
  { path: 'participants', select: AUTHOR_FIELDS },
  { path: 'lastMessage', select: 'sender content type createdAt deletedAt' },
];

export class ConversationRepository extends DatabaseRepository<IConversation> {
  constructor() {
    super(ConversationModel);
  }

  /** Existing one-to-one conversation between exactly these two users, or null. */
  async findDirectBetween(a: Types.ObjectId, b: Types.ObjectId) {
    return this.findOne({ filter: { isGroup: false, participants: { $all: [a, b], $size: 2 } } });
  }

  /** Conversations the user participates in, most recently active first. */
  async paginateForUser(userId: Types.ObjectId, page: number, size: number) {
    return this.paginateLean<{ participants: AuthorCard[]; lastMessage: MessagePreview | null }>({
      filter: { participants: userId },
      options: { sort: { updatedAt: -1 }, populate: conversationPopulate },
      page,
      size,
    });
  }

  /** Ids of everyone who shares at least one conversation with the user (presence fan-out). */
  async contactIds(userId: Types.ObjectId): Promise<string[]> {
    const ids = await this.distinctIds('participants', { participants: userId });
    return ids.filter((id) => id !== String(userId));
  }

  async setLastMessage(conversationId: Types.ObjectId, messageId: Types.ObjectId): Promise<void> {
    await this.updateOne({ filter: { _id: conversationId }, data: { $set: { lastMessage: messageId } } });
  }
}

export const conversationRepository = new ConversationRepository();
