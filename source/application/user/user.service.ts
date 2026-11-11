import type { JwtPayload } from 'jsonwebtoken';
import type { Types } from 'mongoose';

import { blockRepository } from '../../database/repository/block.repository.js';
import { followRepository } from '../../database/repository/follow.repository.js';
import { followRequestRepository } from '../../database/repository/friend-request.repository.js';
import { postRepository } from '../../database/repository/post.repository.js';
import { userRepository } from '../../database/repository/user.repository.js';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '../../dependency/exception/main.exception.js';
import type { IHandlerResult } from '../../dependency/service/util.service.js';
import { utilService } from '../../dependency/service/util.service.js';
import { FollowRequestStatusEnum, GenderEnum, UserPrivacyControllerEnum } from '../../dependency/value/database.enum.js';
import { socketGateway } from '../../realtime/socket.gateway.js';
import { followRequestService } from '../follow-request/follow-request.service.js';
import { postService } from '../post/post.service.js';
import type { BlockedUsersQuery, SearchUsersQuery, SuggestUsersQuery, UpdateMeBody, UserListQuery } from './dto/user.dto.js';

/** Fields a non-follower still sees on a private profile. */
const LIMITED_FIELDS = ['_id', 'firstName', 'lastName', 'username', 'image', 'privacyController', 'followersCount', 'followingCount', 'postsCount'] as const;

class UserService {
  private notFound = () => new NotFoundException('User not found', { messageCode: 401 });

  /** Active, non-blocked target user, or 404 (a block looks exactly like a missing account). */
  private findReachable = async (targetId: Types.ObjectId, viewer: Types.ObjectId) => {
    const user = await userRepository.findPublicById(targetId);
    if (!user) throw this.notFound();
    if (!targetId.equals(viewer) && (await blockRepository.isBlockedEither(viewer, targetId))) throw this.notFound();
    return user;
  };

  /** Followers / following / posts of a private account are only for the owner and followers. */
  private assertCanSeeContent = async (target: Types.ObjectId, viewer: Types.ObjectId): Promise<{ isFollower: boolean }> => {
    const user = await this.findReachable(target, viewer);
    if (target.equals(viewer)) return { isFollower: false };
    const isFollower = await followRepository.isFollowing(viewer, target);
    if (user.privacyController === UserPrivacyControllerEnum.private && !isFollower) {
      throw new ForbiddenException('This account is private', { messageCode: 419 });
    }
    return { isFollower };
  };

  getMe = async (payload: JwtPayload): Promise<IHandlerResult> => {
    const user = await userRepository.findById(utilService.currentUserId(payload));
    if (!user) throw this.notFound();
    return { messageCode: 107, data: user };
  };

  updateMe = async (body: UpdateMeBody, payload: JwtPayload): Promise<IHandlerResult> => {
    const me = utilService.currentUserId(payload);

    if (body.username) {
      const taken = await userRepository.findOne({ filter: { username: body.username, _id: { $ne: me } }, options: { select: '_id', lean: true } });
      if (taken) throw new ConflictException('Username taken', { messageCode: 424 });
    }

    const { gender, ...rest } = body;
    const set: Record<string, unknown> = Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined));
    if (gender) set['gender'] = gender === 'MALE' ? GenderEnum.MALE : GenderEnum.FEMALE;

    try {
      const user = await userRepository.findByIdAndUpdate(me, { $set: set });
      if (!user) throw this.notFound();
      return { messageCode: 415, data: user };
    } catch (error) {

      if ((error as { code?: number }).code === 11000) throw new ConflictException('Username taken', { messageCode: 424 });
      throw error;
    }
  };

  changeImage = async (field: 'image' | 'coverImage', file: Express.Multer.File, payload: JwtPayload): Promise<IHandlerResult> => {
    const user = await userRepository.findByIdAndUpdate(utilService.currentUserId(payload), { $set: { [field]: file.path } });
    if (!user) throw this.notFound();
    return { messageCode: 415, data: { [field]: user[field] } };
  };

  getProfile = async (userId: string, payload: JwtPayload): Promise<IHandlerResult> => {
    const viewer = utilService.currentUserId(payload);
    const target = utilService.toObjectId(userId);
    const user = await this.findReachable(target, viewer);

    if (target.equals(viewer)) return { messageCode: 107, data: { ...user, relationship: { isSelf: true } } };

    const [isFollowing, followsYou, request] = await Promise.all([
      followRepository.isFollowing(viewer, target),
      followRepository.isFollowing(target, viewer),
      followRequestRepository.findBetween(viewer, target),
    ]);
    const relationship = {
      isSelf: false,
      isFollowing,
      followsYou,
      followRequest: request?.status === FollowRequestStatusEnum.PENDING ? { _id: request._id, status: request.status } : null,
      isOnline: socketGateway.isOnline(target),
    };

    const isRestricted = user.privacyController === UserPrivacyControllerEnum.private && !isFollowing;
    const data = isRestricted ? utilService.pick(user, LIMITED_FIELDS) : user;

    return { messageCode: 107, data: { ...data, isRestricted, relationship } };
  };

  followers = async (userId: string, query: UserListQuery, payload: JwtPayload): Promise<IHandlerResult> => {
    const viewer = utilService.currentUserId(payload);
    const target = utilService.toObjectId(userId);
    await this.assertCanSeeContent(target, viewer);
    const hidden = await blockRepository.hiddenUserIds(viewer);
    return { messageCode: 420, ...(await followRepository.paginateFollowers(target, query.page, query.size, hidden)) };
  };

  following = async (userId: string, query: UserListQuery, payload: JwtPayload): Promise<IHandlerResult> => {
    const viewer = utilService.currentUserId(payload);
    const target = utilService.toObjectId(userId);
    await this.assertCanSeeContent(target, viewer);
    const hidden = await blockRepository.hiddenUserIds(viewer);
    return { messageCode: 420, ...(await followRepository.paginateFollowing(target, query.page, query.size, hidden)) };
  };

  posts = async (userId: string, query: UserListQuery, payload: JwtPayload): Promise<IHandlerResult> => {
    const viewer = utilService.currentUserId(payload);
    const target = utilService.toObjectId(userId);
    const { isFollower } = await this.assertCanSeeContent(target, viewer);
    const { data, meta } = utilService.paged(await postRepository.paginateByAuthorFor(target, viewer, isFollower, query.page, query.size));
    return { messageCode: 902, data: await postService.withViewerFlags(data, viewer), meta };
  };

  search = async (query: SearchUsersQuery, payload: JwtPayload): Promise<IHandlerResult> => {
    const hidden = await blockRepository.hiddenUserIds(utilService.currentUserId(payload));
    const result = await userRepository.searchUsers({ search: query.q, excludeIds: hidden, page: query.page, size: query.size });
    return { messageCode: 420, ...utilService.paged(result) };
  };

  /** People you don't follow, haven't requested, and aren't blocked from. */
  suggest = async (query: SuggestUsersQuery, payload: JwtPayload): Promise<IHandlerResult> => {
    const me = utilService.currentUserId(payload);
    const [following, hidden, requested] = await Promise.all([
      followRepository.followingIds(me),
      blockRepository.hiddenUserIds(me),
      followRequestRepository.distinctIds('recipient', { requester: me, status: FollowRequestStatusEnum.PENDING }),
    ]);
    const result = await userRepository.suggestUsers({ userId: me, excludeIds: [...following, ...hidden, ...requested], page: query.page, size: query.size });
    return { messageCode: 420, ...utilService.paged(result) };
  };

  blocked = async (query: BlockedUsersQuery, payload: JwtPayload): Promise<IHandlerResult> => {
    const { data, meta } = await blockRepository.paginateBlockedBy(utilService.currentUserId(payload), query.page, query.size);
    return { messageCode: 420, data, meta };
  };

  /** Blocking severs follows both ways and clears pending requests. Idempotent. */
  block = async (userId: string, payload: JwtPayload): Promise<IHandlerResult> => {
    const me = utilService.currentUserId(payload);
    const target = utilService.toObjectId(userId);
    if (me.equals(target)) throw new BadRequestException('Cannot block yourself', { messageCode: 418 });
    if (!(await userRepository.findPublicById(target))) throw this.notFound();

    const created = await blockRepository.createIfAbsent({ blocker: me, blocked: target });
    if (created) {
      await Promise.all([
        followRequestService.removeFollow(me, target),
        followRequestService.removeFollow(target, me),
        followRequestRepository.deleteBetween(me, target),
      ]);
    }
    return { messageCode: 416, data: { userId: target, isBlocked: true } };
  };

  unblock = async (userId: string, payload: JwtPayload): Promise<IHandlerResult> => {
    const removed = await blockRepository.deleteIfPresent({ blocker: utilService.currentUserId(payload), blocked: utilService.toObjectId(userId) });
    if (!removed) throw new NotFoundException('User is not blocked', { messageCode: 423 });
    return { messageCode: 417, data: { userId, isBlocked: false } };
  };

  unfollow = async (userId: string, payload: JwtPayload): Promise<IHandlerResult> => {
    const removed = await followRequestService.removeFollow(utilService.currentUserId(payload), utilService.toObjectId(userId));
    if (!removed) throw new NotFoundException('Not following', { messageCode: 422 });
    return { messageCode: 421, data: { userId, isFollowing: false } };
  };
}

export const userService = new UserService();
