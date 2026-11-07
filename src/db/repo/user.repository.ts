import { DatabaseRepository } from './base.repository.js';
import { UserModel } from '../model/user.model.js';
import { IUser } from '../../dep/interface/database.interface.js';
import { QueryFilter } from 'mongoose';

export class UserRepository extends DatabaseRepository<IUser> {
  constructor() {
    super(UserModel);
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
}

export const userRepository = new UserRepository();
