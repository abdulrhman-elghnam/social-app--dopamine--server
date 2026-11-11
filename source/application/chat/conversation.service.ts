import type { JwtPayload } from 'jsonwebtoken';
import type { HydratedDocument, Types } from 'mongoose';
import { blockRepository } from '../../database/repository/block.repository.js';
import { conversationMemberRepository } from '../../database/repository/conversation-member.repository.js';
import { conversationPopulate, conversationRepository } from '../../database/repository/conversation.repository.js';
import { messageRepository } from '../../database/repository/message.repository.js';
import { userRepository } from '../../database/repository/user.repository.js';
import { BadRequestException, ForbiddenException, NotFoundException } from '../../dependency/exception/main.exception.js';
import type { IConversation, IConversationMember } from '../../dependency/interface/database.interface.js';
import type { IHandlerResult } from '../../dependency/service/util.service.js';
import { utilService } from '../../dependency/service/util.service.js';
import { ConversationMemberRoleEnum } from '../../dependency/value/database.enum.js';
import { socketGateway } from '../../realtime/socket.gateway.js';
import { Rooms, SocketEvents } from '../../realtime/socket.events.js';
import type { CreateConversationBody, GetMessagesQuery, ListConversationsQuery, MuteConversationBody, UpdateGroupBody } from './dto/conversation.dto.js';

type HConversation = HydratedDocument<IConversation>;
type HMembership = HydratedDocument<IConversationMember>;

const ADMIN_ROLES = [ConversationMemberRoleEnum.ADMIN, ConversationMemberRoleEnum.OWNER];

type Redactable = { deletedAt?: Date | undefined; content?: string | undefined; media?: unknown[] | undefined };
type Redacted<M> = Omit<M, 'content' | 'media'> & { content?: string | undefined; media?: unknown[] | undefined };

/** Deleted messages keep their place in history but lose their payload. */
export const redactMessage = <M extends Redactable>(message: M): Redacted<M> => {
  if (!message.deletedAt) return message;
  const { content: _content, media: _media, ...rest } = message;
  return { ...rest, media: [] };
};

class ConversationService {
  /** Conversation + the caller's membership; 404 for non-members (existence is not leaked). */
  findMembership = async (
    conversationId: string | Types.ObjectId,
    userId: Types.ObjectId,
  ): Promise<{ conversation: HConversation; membership: HMembership }> => {
    const id = typeof conversationId === 'string' ? utilService.toObjectId(conversationId) : conversationId;
    const [conversation, membership] = await Promise.all([conversationRepository.findById(id), conversationMemberRepository.findMembership(id, userId)]);
    if (!conversation || !membership) throw new NotFoundException('Conversation not found', { messageCode: 1208 });
    return { conversation, membership };
  };

  /** Rejects when any of `others` is missing/inactive or blocked with `me`. */
  private assertCanMessage = async (me: Types.ObjectId, others: Types.ObjectId[]): Promise<void> => {
    const found = await userRepository.find({ filter: { _id: { $in: others }, isActive: true }, options: { select: '_id', lean: true } });
    if (found.length !== others.length) throw new NotFoundException('User not found', { messageCode: 401 });
    const hidden = new Set(await blockRepository.hiddenUserIds(me));
    if (others.some((id) => hidden.has(String(id)))) throw new ForbiddenException('Cannot message this user', { messageCode: 1211 });
  };

  private uniqueOthers = (ids: string[], me: Types.ObjectId): Types.ObjectId[] =>
    [...new Set(ids)].filter((id) => id !== String(me)).map((id) => utilService.toObjectId(id));

  list = async (query: ListConversationsQuery, payload: JwtPayload): Promise<IHandlerResult> => {
    const me = utilService.currentUserId(payload);
    const { data, meta } = utilService.paged(await conversationRepository.paginateForUser(me, query.page, query.size));
    const conversations = data;

    const memberships = await conversationMemberRepository.membershipsByConversation(
      me,
      conversations.map((conversation) => conversation._id),
    );
    const lastReadIds = [...memberships.values()].map((row) => row.lastReadMessage).filter((id): id is Types.ObjectId => Boolean(id));
    const lastRead = await messageRepository.find({ filter: { _id: { $in: lastReadIds } }, options: { select: 'createdAt', lean: true } });
    const readAt = new Map(lastRead.map((message) => [String(message._id), message.createdAt]));

    const enriched = await Promise.all(
      conversations.map(async (conversation) => {
        const membership = memberships.get(String(conversation._id));
        const after = membership?.lastReadMessage ? readAt.get(String(membership.lastReadMessage)) : undefined;
        return {
          ...conversation,
          lastMessage: conversation.lastMessage ? redactMessage(conversation.lastMessage) : null,
          isMuted: membership?.isMuted ?? false,
          role: membership?.role,
          unreadCount: await messageRepository.countUnread(conversation._id, me, after),
          onlineParticipants: socketGateway.onlineAmong(conversation.participants.map((user) => user._id)),
        };
      }),
    );

    return { messageCode: 1201, data: enriched, meta };
  };

  /** A direct conversation is unique per pair — asking again returns the existing one. */
  create = async (body: CreateConversationBody, payload: JwtPayload): Promise<IHandlerResult> => {
    const me = utilService.currentUserId(payload);
    const others = this.uniqueOthers(body.participantIds, me);

    if (body.isGroup ? others.length < 2 : others.length !== 1) {
      throw new BadRequestException('Invalid participants', { messageCode: 1214 });
    }
    await this.assertCanMessage(me, others);

    if (!body.isGroup) {
      const [other] = others as [Types.ObjectId];
      const existing = await conversationRepository.findDirectBetween(me, other);
      if (existing) {
        await existing.populate(conversationPopulate);
        return { messageCode: 1203, data: existing };
      }
    }

    const conversation = await conversationRepository.create({
      data: {
        participants: [me, ...others],
        isGroup: body.isGroup,
        createdBy: me,
        admins: body.isGroup ? [me] : [],
        ...(body.isGroup && body.groupName ? { groupName: body.groupName } : {}),
        ...(body.isGroup && body.groupImage ? { groupImage: body.groupImage } : {}),
      },
    });

    await conversationMemberRepository.createMany({
      data: [me, ...others].map((user) => ({
        conversation: conversation._id,
        user,
        role: body.isGroup && user.equals(me) ? ConversationMemberRoleEnum.OWNER : ConversationMemberRoleEnum.MEMBER,
        joinedAt: new Date(),
        isMuted: false,
      })),
    });

    await conversation.populate(conversationPopulate);
    return { status: 201, messageCode: 1202, data: conversation };
  };

  get = async (conversationId: string, payload: JwtPayload): Promise<IHandlerResult> => {
    const { conversation, membership } = await this.findMembership(conversationId, utilService.currentUserId(payload));
    await conversation.populate(conversationPopulate);
    return {
      messageCode: 1203,
      data: {
        ...conversation.toObject(),
        isMuted: membership.isMuted,
        role: membership.role,
        lastReadMessage: membership.lastReadMessage ?? null,
        onlineParticipants: socketGateway.onlineAmong(conversation.participants.map(utilService.refId)),
      },
    };
  };

  /** Group admins rename, change the image, add or remove members. The owner can't be removed. */
  updateGroup = async (conversationId: string, body: UpdateGroupBody, payload: JwtPayload): Promise<IHandlerResult> => {
    const me = utilService.currentUserId(payload);
    const { conversation, membership } = await this.findMembership(conversationId, me);

    if (!conversation.isGroup) throw new BadRequestException('Not a group', { messageCode: 1209 });
    if (!ADMIN_ROLES.includes(membership.role)) throw new ForbiddenException('Admins only', { messageCode: 1210 });

    const set: Partial<IConversation> = {};
    if (body.groupName !== undefined) set.groupName = body.groupName;
    if (body.groupImage !== undefined) set.groupImage = body.groupImage;

    const toAdd = this.uniqueOthers(body.addMembers ?? [], me).filter((id) => !conversation.participants.some((p) => p.equals(id)));
    const toRemove = this.uniqueOthers(body.removeMembers ?? [], me).filter((id) => conversation.participants.some((p) => p.equals(id)));

    if (toRemove.length) {
      const owners = await conversationMemberRepository.find({
        filter: { conversation: conversation._id, user: { $in: toRemove }, role: ConversationMemberRoleEnum.OWNER },
        options: { select: '_id', lean: true },
      });
      if (owners.length) throw new ForbiddenException('The group owner cannot be removed', { messageCode: 1210 });
    }
    if (toAdd.length) await this.assertCanMessage(me, toAdd);

    if (Object.keys(set).length) await conversationRepository.updateOne({ filter: { _id: conversation._id }, data: { $set: set } });
    if (toAdd.length) {
      await conversationRepository.updateOne({ filter: { _id: conversation._id }, data: { $addToSet: { participants: { $each: toAdd } } } });
      await Promise.all(
        toAdd.map((user) =>
          conversationMemberRepository.createIfAbsent(
            { conversation: conversation._id, user },
            { role: ConversationMemberRoleEnum.MEMBER, joinedAt: new Date(), isMuted: false },
          ),
        ),
      );
    }
    if (toRemove.length) {
      await conversationRepository.updateOne({
        filter: { _id: conversation._id },
        data: { $pull: { participants: { $in: toRemove }, admins: { $in: toRemove } } },
      });
      await conversationMemberRepository.deleteMany({ conversation: conversation._id, user: { $in: toRemove } });
      // Kick removed members' sockets out of the live room.
      socketGateway.server?.in(toRemove.map((id) => Rooms.user(String(id)))).socketsLeave(Rooms.conversation(String(conversation._id)));
    }

    const updated = await conversationRepository.findById(conversation._id, { populate: conversationPopulate });
    socketGateway.emitToConversationMembers(conversation._id, [...conversation.participants, ...toAdd], SocketEvents.CONVERSATION_UPDATED, updated);

    return { messageCode: 1204, data: updated };
  };

  messages = async (conversationId: string, query: GetMessagesQuery, payload: JwtPayload): Promise<IHandlerResult> => {
    const { conversation } = await this.findMembership(conversationId, utilService.currentUserId(payload));
    const { data, meta } = utilService.paged(await messageRepository.paginateByConversation(conversation._id, query.page, query.size));
    return { messageCode: 1205, data: data.map(redactMessage), meta };
  };

  mute = async (conversationId: string, body: MuteConversationBody, payload: JwtPayload): Promise<IHandlerResult> => {
    const { membership } = await this.findMembership(conversationId, utilService.currentUserId(payload));
    membership.isMuted = body.muted;
    await membership.save();
    return { messageCode: 1206, data: { conversationId, isMuted: membership.isMuted } };
  };

  /**
   * Moves the caller's read marker to `messageId` (or the latest message), marks earlier
   * messages as read, and broadcasts `message:read:update`. Shared by REST and the socket.
   */
  markRead = async (conversationId: string, userId: Types.ObjectId, messageId?: string) => {
    const { conversation, membership } = await this.findMembership(conversationId, userId);

    const message = messageId
      ? await messageRepository.findOne({ filter: { _id: utilService.toObjectId(messageId), conversation: conversation._id } })
      : await messageRepository.findOne({ filter: { conversation: conversation._id }, options: { sort: { createdAt: -1 } } });
    if (!message) {
      if (messageId) throw new NotFoundException('Message not found', { messageCode: 1212 });
      return { conversationId, userId, messageId: null, readAt: new Date() };
    }

    membership.lastReadMessage = message._id;
    await membership.save();
    await messageRepository.markReadUpTo(conversation._id, userId, message.createdAt ?? new Date());

    const update = { conversationId, userId, messageId: message._id, readAt: new Date() };
    socketGateway.emitToConversationMembers(conversation._id, conversation.participants, SocketEvents.MESSAGE_READ_UPDATE, update);
    return update;
  };

  markReadHandler = async (conversationId: string, messageId: string | undefined, payload: JwtPayload): Promise<IHandlerResult> => {
    return { messageCode: 1207, data: await this.markRead(conversationId, utilService.currentUserId(payload), messageId) };
  };
}

export const conversationService = new ConversationService();
