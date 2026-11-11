import type { Types } from 'mongoose';
import { CommentLikeModel } from '../model/comment-like.model.js';
import type { ICommentLike } from '../../dependency/interface/database.interface.js';
import { DatabaseRepository } from './base.repository.js';

export class CommentLikeRepository extends DatabaseRepository<ICommentLike> {
  constructor() {
    super(CommentLikeModel);
  }

  /** Comment ids (of `commentIds`) the user has liked. */
  async idsAmong(userId: Types.ObjectId, commentIds: Types.ObjectId[]): Promise<Set<string>> {
    if (!commentIds.length) return new Set();
    return new Set(await this.distinctIds('comment', { user: userId, comment: { $in: commentIds } }));
  }
}

export const commentLikeRepository = new CommentLikeRepository();
