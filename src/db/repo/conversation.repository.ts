import { ConversationModel } from '../model/conversation.model.js';
import type { IConversation } from '../../dep/interface/database.interface.js';
import { DatabaseRepository } from './base.repository.js';

export class ConversationRepository extends DatabaseRepository<IConversation> {
  constructor() {
    super(ConversationModel);
  }
}

export const conversationRepository = new ConversationRepository();
