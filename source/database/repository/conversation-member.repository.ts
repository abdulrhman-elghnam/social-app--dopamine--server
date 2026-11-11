import type { Types } from 'mongoose';
import { ConversationMemberModel } from '../model/conversation-member.model.js';
import type { IConversationMember } from '../../dependency/interface/database.interface.js';
import { DatabaseRepository } from './base.repository.js';

export class ConversationMemberRepository extends DatabaseRepository<IConversationMember> {
  constructor() {
    super(ConversationMemberModel);
  }

  async findMembership(conversation: Types.ObjectId, user: Types.ObjectId) {
    return this.findOne({ filter: { conversation, user } });
  }

  async membershipsByConversation(user: Types.ObjectId, conversationIds: Types.ObjectId[]) {
    const rows = await this.find({ filter: { user, conversation: { $in: conversationIds } }, options: { lean: true } });
    return new Map(rows.map((row) => [String(row.conversation), row]));
  }
}

export const conversationMemberRepository = new ConversationMemberRepository();
