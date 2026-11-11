import type { QueryFilter, Types } from 'mongoose';
import { DatabaseRepository } from './base.repository.js';
import { UserModel } from '../model/user.model.js';
import type { IUser } from '../../dependency/interface/database.interface.js';
import { PUBLIC_USER_FIELDS } from '../../dependency/value/projection.value.js';

type Counter = 'postsCount' | 'followersCount' | 'followingCount';

const escapeRegex = (value: string) => value.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export class UserRepository extends DatabaseRepository<IUser> {
  constructor() {
    super(UserModel);
  }

  async changeCounter(userId: Types.ObjectId, field: Counter, amount: 1 | -1): Promise<void> {
    await this.updateOne({
      filter: amount < 0 ? { _id: userId, [field]: { $gt: 0 } } : { _id: userId },
      data: { $inc: { [field]: amount } },
    });
  }

  async changePostsCount(userId: Types.ObjectId, amount: 1 | -1): Promise<void> {
    await this.changeCounter(userId, 'postsCount', amount);
  }

  async updateFollowCounts({ followerId, followingId, amount }: { followerId: Types.ObjectId; followingId: Types.ObjectId; amount: 1 | -1 }): Promise<void> {
    await Promise.all([this.changeCounter(followingId, 'followersCount', amount), this.changeCounter(followerId, 'followingCount', amount)]);
  }

  async findPublicById(userId: Types.ObjectId) {
    return this.findOne({ filter: { _id: userId, isActive: true }, options: { select: PUBLIC_USER_FIELDS, lean: true } });
  }

  async searchUsers({ search, excludeIds = [], page = 1, size = 10 }: { search: string; excludeIds?: string[]; page?: number; size?: number }) {
    const pattern = { $regex: escapeRegex(search), $options: 'i' };
    const filter: QueryFilter<IUser> = {
      isActive: true,
      _id: { $nin: excludeIds },
      $or: [{ firstName: pattern }, { lastName: pattern }, { username: pattern }],
    };
    return this.paginateLean({ filter, options: { select: PUBLIC_USER_FIELDS, sort: { followersCount: -1, createdAt: -1 } }, page, size });
  }

  async suggestUsers({ userId, excludeIds, page = 1, size = 10 }: { userId: Types.ObjectId; excludeIds: string[]; page?: number; size?: number }) {
    const filter: QueryFilter<IUser> = { isActive: true, _id: { $nin: [userId, ...excludeIds] } };
    return this.paginateLean({ filter, options: { select: PUBLIC_USER_FIELDS, sort: { followersCount: -1, createdAt: -1 } }, page, size });
  }
}

export const userRepository = new UserRepository();
