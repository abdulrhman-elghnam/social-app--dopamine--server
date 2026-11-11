import type { Types } from 'mongoose';
import { FollowModel } from '../model/follow.model.js';
import type { IFollow } from '../../dependency/interface/database.interface.js';
import { PUBLIC_USER_FIELDS } from '../../dependency/value/projection.value.js';
import { DatabaseRepository } from './base.repository.js';
import type { PublicUser } from '../../dependency/value/projection.value.js';

export class FollowRepository extends DatabaseRepository<IFollow> {
  constructor() {
    super(FollowModel);
  }

  async isFollowing(followerId: Types.ObjectId, followingId: Types.ObjectId): Promise<boolean> {
    const follow = await this.findOne({ filter: { follower: followerId, following: followingId }, options: { select: '_id', lean: true } });
    return follow !== null;
  }

  async followingIds(userId: Types.ObjectId): Promise<string[]> {
    return this.distinctIds('following', { follower: userId });
  }

  async paginateFollowers(userId: Types.ObjectId, page: number, size: number, hiddenIds: string[] = []) {
    const { data, ...meta } = await this.paginateLean<{ follower: PublicUser | null }>({
      filter: { following: userId, follower: { $nin: hiddenIds } },
      options: { sort: { createdAt: -1 }, populate: { path: 'follower', select: PUBLIC_USER_FIELDS } },
      page,
      size,
    });
    return { data: data.map((row) => row.follower).filter((user): user is PublicUser => user !== null), meta };
  }

  async paginateFollowing(userId: Types.ObjectId, page: number, size: number, hiddenIds: string[] = []) {
    const { data, ...meta } = await this.paginateLean<{ following: PublicUser | null }>({
      filter: { follower: userId, following: { $nin: hiddenIds } },
      options: { sort: { createdAt: -1 }, populate: { path: 'following', select: PUBLIC_USER_FIELDS } },
      page,
      size,
    });
    return { data: data.map((row) => row.following).filter((user): user is PublicUser => user !== null), meta };
  }
}

export const followRepository = new FollowRepository();
