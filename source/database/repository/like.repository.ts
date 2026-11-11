import type { Types } from 'mongoose';
import { LikeModel } from '../model/like.model.js';
import type { ILike } from '../../dependency/interface/database.interface.js';
import { DatabaseRepository } from './base.repository.js';

export class LikeRepository extends DatabaseRepository<ILike> {
  constructor() {
    super(LikeModel);
  }

  async idsAmong(userId: Types.ObjectId, postIds: Types.ObjectId[]): Promise<Set<string>> {
    if (!postIds.length) return new Set();
    return new Set(await this.distinctIds('post', { user: userId, post: { $in: postIds } }));
  }
}

export const likeRepository = new LikeRepository();
