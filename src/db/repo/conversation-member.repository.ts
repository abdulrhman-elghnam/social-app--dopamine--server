import { ConversationMemberModel } from '../model/conversation-member.model.js';
import type { IConversationMember } from '../../dep/interface/database.interface.js';
import { DatabaseRepository } from './base.repository.js';

export class ConversationMemberRepository extends DatabaseRepository<IConversationMember> {
  constructor() {
    super(ConversationMemberModel);
  }
}

export const conversationMemberRepository = new ConversationMemberRepository();
