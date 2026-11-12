import type { Types } from 'mongoose';
import { SavedPostModel } from '../model/save-post.model.js';
import type { ISavedPost } from '../../dependency/interface/database.interface.js';
import { DatabaseRepository } from './base.repository.js';

export class SavedPostRepository extends DatabaseRepository<ISavedPost> {
  constructor() {
    super(SavedPostModel);
  }

  async idsAmong(userId: Types.ObjectId, postIds: Types.ObjectId[]): Promise<Set<string>> {
    if (!postIds.length) return new Set();
    return new Set(await this.distinctIds('post', { user: userId, post: { $in: postIds } }));
  }
}

export const savedPostRepository = new SavedPostRepository();
