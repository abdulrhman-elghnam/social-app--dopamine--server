import type { JwtPayload } from 'jsonwebtoken';
import type { Types } from 'mongoose';

import { blockRepository } from '../../database/repository/block.repository.js';
import { followRepository } from '../../database/repository/follow.repository.js';
import { followRequestRepository } from '../../database/repository/friend-request.repository.js';
import { userRepository } from '../../database/repository/user.repository.js';
import { BadRequestException, ConflictException, NotFoundException } from '../../dependency/exception/main.exception.js';
import type { IHandlerResult } from '../../dependency/service/util.service.js';
import { utilService } from '../../dependency/service/util.service.js';
import { FollowRequestStatusEnum, NotificationTypeEnum, UserPrivacyControllerEnum } from '../../dependency/value/database.enum.js';
import { notificationService } from '../notification/notification.service.js';
import type { ListFollowRequestsQuery } from './dto/follow-request.dto.js';

class FollowRequestService {

  createFollow = async (followerId: Types.ObjectId, followingId: Types.ObjectId): Promise<boolean> => {
    const created = await followRepository.createIfAbsent({ follower: followerId, following: followingId });
    if (created) await userRepository.updateFollowCounts({ followerId, followingId, amount: 1 });
    return created;
  };

  removeFollow = async (followerId: Types.ObjectId, followingId: Types.ObjectId): Promise<boolean> => {
    const removed = await followRepository.deleteIfPresent({ follower: followerId, following: followingId });
    if (removed) {
      await userRepository.updateFollowCounts({ followerId, followingId, amount: -1 });
      await notificationService.retract({ recipient: followingId, sender: followerId, type: NotificationTypeEnum.FOLLOW });
    }
    return removed;
  };


  send = async (targetId: string, payload: JwtPayload): Promise<IHandlerResult> => {
    const me = utilService.currentUserId(payload);
    const target = utilService.toObjectId(targetId);

    if (me.equals(target)) throw new BadRequestException('Cannot follow yourself', { messageCode: 418 });

    const user = await userRepository.findPublicById(target);
    if (!user || (await blockRepository.isBlockedEither(me, target))) {
      throw new NotFoundException('User not found', { messageCode: 401 });
    }
    if (await followRepository.isFollowing(me, target)) {
      throw new ConflictException('Already following', { messageCode: 432 });
    }

    if (user.privacyController !== UserPrivacyControllerEnum.private) {
      await this.createFollow(me, target);
      await notificationService.notify({ recipient: target, sender: me, type: NotificationTypeEnum.FOLLOW });
      return { status: 201, messageCode: 431, data: { status: 'following' } };
    }

    const existing = await followRequestRepository.findBetween(me, target);
    if (existing?.status === FollowRequestStatusEnum.PENDING) {
      throw new ConflictException('Request already pending', { messageCode: 433 });
    }

    const request = await followRequestRepository.findOneAndUpdate({
      filter: { requester: me, recipient: target },
      data: { $set: { status: FollowRequestStatusEnum.PENDING } },
      options: { upsert: true },
    });
    await notificationService.notify({ recipient: target, sender: me, type: NotificationTypeEnum.FOLLOW_REQUEST });

    return { status: 201, messageCode: 430, data: { status: 'requested', request } };
  };

  private findPendingReceived = async (requestId: string, me: Types.ObjectId) => {
    const request = await followRequestRepository.findOne({ filter: { _id: utilService.toObjectId(requestId), recipient: me } });
    if (!request) throw new NotFoundException('Follow request not found', { messageCode: 437 });
    if (request.status !== FollowRequestStatusEnum.PENDING) {
      throw new ConflictException('Follow request is no longer pending', { messageCode: 439 });
    }
    return request;
  };

  accept = async (requestId: string, payload: JwtPayload): Promise<IHandlerResult> => {
    const me = utilService.currentUserId(payload);
    const request = await this.findPendingReceived(requestId, me);

    await this.createFollow(request.requester, me);
    request.status = FollowRequestStatusEnum.ACCEPTED;
    await request.save();

    await notificationService.retract({ recipient: me, sender: request.requester, type: NotificationTypeEnum.FOLLOW_REQUEST });
    await notificationService.notify({ recipient: request.requester, sender: me, type: NotificationTypeEnum.FOLLOW_ACCEPTED });

    return { messageCode: 434, data: request };
  };

  reject = async (requestId: string, payload: JwtPayload): Promise<IHandlerResult> => {
    const me = utilService.currentUserId(payload);
    const request = await this.findPendingReceived(requestId, me);

    request.status = FollowRequestStatusEnum.REJECTED;
    await request.save();
    await notificationService.retract({ recipient: me, sender: request.requester, type: NotificationTypeEnum.FOLLOW_REQUEST });

    return { messageCode: 435, data: request };
  };

  cancel = async (requestId: string, payload: JwtPayload): Promise<IHandlerResult> => {
    const me = utilService.currentUserId(payload);
    const request = await followRequestRepository.findOneAndDelete({
      _id: utilService.toObjectId(requestId),
      requester: me,
      status: FollowRequestStatusEnum.PENDING,
    });
    if (!request) throw new NotFoundException('Follow request not found', { messageCode: 437 });

    await notificationService.retract({ recipient: request.recipient, sender: me, type: NotificationTypeEnum.FOLLOW_REQUEST });
    return { messageCode: 436 };
  };

  list = async (direction: 'received' | 'sent', query: ListFollowRequestsQuery, payload: JwtPayload): Promise<IHandlerResult> => {
    const result = await followRequestRepository.paginatePending(utilService.currentUserId(payload), direction, query.page, query.size);
    return { messageCode: 438, ...utilService.paged(result) };
  };
}

export const followRequestService = new FollowRequestService();
