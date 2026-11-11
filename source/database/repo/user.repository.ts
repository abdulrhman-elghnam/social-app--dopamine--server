import { DatabaseRepository } from './base.repository.js';
import { UserModel } from '../model/user.model.js';
import { IUser } from '../../dependency/interface/database.interface.js';
import { QueryFilter } from 'mongoose';
import { Types } from 'mongoose';
import { FollowModel } from '../model/follow.model.js';

export class UserRepository extends DatabaseRepository<IUser> {
  constructor() {
    super(UserModel);
  }

  async updateFollowCounts({
    followerId,
    followingId,
    amount,
  }: {
    followerId: Types.ObjectId | string;
    followingId: Types.ObjectId | string;
    amount: 1 | -1;
  }): Promise<void> {
    await Promise.all([
      UserModel.updateOne(
        { _id: followingId },
        [
          {
            $set: {
              followersCount: {
                $max: [{ $add: [{ $ifNull: ['$followersCount', 0] }, amount] }, 0],
              },
            },
          },
        ]
      ).exec(),
      UserModel.updateOne(
        { _id: followerId },
        [
          {
            $set: {
              followingCount: {
                $max: [{ $add: [{ $ifNull: ['$followingCount', 0] }, amount] }, 0],
              },
            },
          },
        ]
      ).exec(),
    ]);
  }

  async searchUsers({
    search,
    filter = {},
    page = 1,
    size = 10,
  }: {
    search: string;
    filter?: QueryFilter<IUser>;
    page?: number;
    size?: number;
  }) {
    const searchValue = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const searchFilter: QueryFilter<IUser> = {
      $and: [
        filter,
        {
          $or: [
            { firstName: { $regex: searchValue, $options: 'i' } },
            { lastName: { $regex: searchValue, $options: 'i' } },
            { username: { $regex: searchValue, $options: 'i' } },
            { email: { $regex: searchValue, $options: 'i' } },
          ],
        },
      ],
    };

    const currentPage = Math.max(1, page);
    const pageSize = Math.max(1, size);
    const skip = (currentPage - 1) * pageSize;

    const [data, totalDocuments] = await Promise.all([
      UserModel.find(searchFilter).skip(skip).limit(pageSize).sort({ createdAt: -1 }).lean().exec(),

      UserModel.countDocuments(searchFilter).exec(),
    ]);

    return {
      data,
      totalDocuments,
      totalPages: Math.ceil(totalDocuments / pageSize),
      currentPage,
      pageSize,
    };
  }

  async suggestUsers({
    userId,
    page = 1,
    size = 10,
  }: {
    userId: Types.ObjectId | string;
    page?: number;
    size?: number;
  }) {
    const currentUserId = new Types.ObjectId(userId);
    const followingIds = await FollowModel.distinct('following', { follower: currentUserId });
    const excludedIds = [currentUserId, ...followingIds.map((id) => new Types.ObjectId(id))];
    const filter: QueryFilter<IUser> = {
      _id: { $nin: excludedIds },
      isActive: true,
    };

    const currentPage = Math.max(1, page);
    const pageSize = Math.max(1, size);
    const skip = (currentPage - 1) * pageSize;

    const [data, totalDocuments] = await Promise.all([
      UserModel.find(filter)
        .skip(skip)
        .limit(pageSize)
        .sort({ followersCount: -1, createdAt: -1 })
        .lean()
        .exec(),
      UserModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      totalDocuments,
      totalPages: Math.ceil(totalDocuments / pageSize),
      currentPage,
      pageSize,
    };
  }
}

export const userRepository = new UserRepository();
