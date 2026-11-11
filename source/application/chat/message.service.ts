import type { Types } from 'mongoose';

import { blockRepository } from '../../database/repository/block.repository.js';
import { conversationRepository } from '../../database/repository/conversation.repository.js';
import { messageRepository } from '../../database/repository/message.repository.js';
import { ForbiddenException, NotFoundException } from '../../dependency/exception/main.exception.js';
import { utilService } from '../../dependency/service/util.service.js';
import { AUTHOR_FIELDS } from '../../dependency/value/projection.value.js';
import { socketGateway } from '../../realtime/socket.gateway.js';
import { SocketEvents } from '../../realtime/socket.events.js';
import { conversationService } from './conversation.service.js';
import type { DeleteMessageInput, EditMessageInput, SendMessageInput } from './dto/message.dto.js';

/** Message lifecycle driven by socket events (`message:send|edit|delete`). */
class MessageService {
  private findOwnMessage = async (messageId: string, userId: Types.ObjectId) => {
    const message = await messageRepository.findOne({ filter: { _id: utilService.toObjectId(messageId), deletedAt: { $exists: false } } });
    if (!message) throw new NotFoundException('Message not found', { messageCode: 1212 });
    if (!message.sender.equals(userId)) throw new ForbiddenException('Not your message', { messageCode: 1213 });
    // Still a member? (removed members can't rewrite history)
    const { conversation } = await conversationService.findMembership(message.conversation, userId);
    return { message, conversation };
  };

  send = async (input: SendMessageInput, sender: Types.ObjectId) => {
    const { conversation } = await conversationService.findMembership(input.conversationId, sender);

    if (!conversation.isGroup) {
      const other = conversation.participants.find((id) => !id.equals(sender));
      if (other && (await blockRepository.isBlockedEither(sender, other))) {
        throw new ForbiddenException('Cannot message this user', { messageCode: 1211 });
      }
    }

    if (input.replyTo) {
      const original = await messageRepository.findOne({
        filter: { _id: utilService.toObjectId(input.replyTo), conversation: conversation._id },
        options: { select: '_id', lean: true },
      });
      if (!original) throw new NotFoundException('Message not found', { messageCode: 1212 });
    }

    const message = await messageRepository.create({
      data: {
        conversation: conversation._id,
        sender,
        type: input.type,
        media: input.media,
        ...(input.content ? { content: input.content } : {}),
        ...(input.replyTo ? { replyTo: utilService.toObjectId(input.replyTo) } : {}),
        readBy: [sender],
        deliveredTo: [sender],
      },
    });
    await conversationRepository.setLastMessage(conversation._id, message._id);
    await message.populate([
      { path: 'sender', select: AUTHOR_FIELDS },
      { path: 'replyTo', select: 'sender content type deletedAt' },
    ]);

    const payload = { ...message.toObject(), clientId: input.clientId };
    socketGateway.emitToConversationMembers(conversation._id, conversation.participants, SocketEvents.MESSAGE_NEW, payload);

    // Anyone with an open socket has received it; tell the sender.
    const recipients = conversation.participants.filter((id) => !id.equals(sender));
    const online = socketGateway.onlineAmong(recipients).map((id) => utilService.toObjectId(id));
    if (online.length) {
      await messageRepository.markDelivered(message._id, online);
      socketGateway.emitToUser(sender, SocketEvents.MESSAGE_DELIVERED, { conversationId: conversation._id, messageId: message._id, deliveredTo: online });
    }

    return payload;
  };

  edit = async (input: EditMessageInput, userId: Types.ObjectId) => {
    const { message, conversation } = await this.findOwnMessage(input.messageId, userId);
    message.content = input.content;
    message.editedAt = new Date();
    await message.save();

    const payload = { conversationId: conversation._id, messageId: message._id, content: message.content, editedAt: message.editedAt };
    socketGateway.emitToConversationMembers(conversation._id, conversation.participants, SocketEvents.MESSAGE_EDITED, payload);
    return payload;
  };

  remove = async (input: DeleteMessageInput, userId: Types.ObjectId) => {
    const { message, conversation } = await this.findOwnMessage(input.messageId, userId);
    await messageRepository.updateOne({ filter: { _id: message._id }, data: { $set: { deletedAt: new Date(), media: [] }, $unset: { content: 1 } } });

    const payload = { conversationId: conversation._id, messageId: message._id };
    socketGateway.emitToConversationMembers(conversation._id, conversation.participants, SocketEvents.MESSAGE_DELETED, payload);
    return payload;
  };
}

export const messageService = new MessageService();
