import { MessageModel } from '../model/message.model.js';
import type { IMessage } from '../../dep/interface/database.interface.js';
import { DatabaseRepository } from './base.repository.js';

export class MessageRepository extends DatabaseRepository<IMessage> {
  constructor() {
    super(MessageModel);
  }
}

export const messageRepository = new MessageRepository();
