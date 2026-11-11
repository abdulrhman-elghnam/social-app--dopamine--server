import type { Types } from 'mongoose';
import { FollowModel } from '../model/follow.model.js';
import type { IFollow } from '../../dependency/interface/database.interface.js';
import { DatabaseRepository } from './base.repository.js';

export class FollowRepository extends DatabaseRepository<IFollow> {
  constructor() {
    super(FollowModel);
  }

  async isFollowing(followerId: Types.ObjectId, followingId: Types.ObjectId): Promise<boolean> {
    const follow = await this.findOne({ filter: { follower: followerId, following: followingId }, options: { select: '_id', lean: true } });
    return follow !== null;
  }
}

export const followRepository = new FollowRepository();
