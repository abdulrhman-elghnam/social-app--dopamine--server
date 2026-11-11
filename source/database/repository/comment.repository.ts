import type { Types } from 'mongoose';
import { CommentModel } from '../model/comment.model.js';
import type { HCommentDocument } from '../model/comment.model.js';
import type { IComment } from '../../dependency/interface/database.interface.js';
import { AUTHOR_FIELDS } from '../../dependency/value/projection.value.js';
import { DatabaseRepository } from './base.repository.js';
import type { AuthorCard } from '../../dependency/value/projection.value.js';

type Counter = 'likesCount' | 'repliesCount';
const ACTIVE = { deletedAt: { $exists: false } } as const;

export class CommentRepository extends DatabaseRepository<IComment> {
  constructor() {
    super(CommentModel);
  }

  async findActiveById(commentId: Types.ObjectId): Promise<HCommentDocument | null> {
    return this.findOne({ filter: { _id: commentId, ...ACTIVE } });
  }

  async findActiveInPost(postId: Types.ObjectId, commentId: Types.ObjectId): Promise<HCommentDocument | null> {
    return this.findOne({ filter: { _id: commentId, post: postId, ...ACTIVE } });
  }

  async paginateByPost(postId: Types.ObjectId, page: number, size: number, hiddenIds: string[] = []) {
    return this.paginateLean<{ author: AuthorCard }>({
      filter: { post: postId, parentComment: { $exists: false }, author: { $nin: hiddenIds }, ...ACTIVE },
      options: { sort: { createdAt: -1 }, populate: { path: 'author', select: AUTHOR_FIELDS } },
      page,
      size,
    });
  }

  async paginateReplies(commentId: Types.ObjectId, page: number, size: number, hiddenIds: string[] = []) {
    return this.paginateLean<{ author: AuthorCard }>({
      filter: { parentComment: commentId, author: { $nin: hiddenIds }, ...ACTIVE },
      options: { sort: { createdAt: 1 }, populate: { path: 'author', select: AUTHOR_FIELDS } },
      page,
      size,
    });
  }

  async softDelete(commentId: Types.ObjectId): Promise<void> {
    await this.updateOne({ filter: { _id: commentId }, data: { $set: { deletedAt: new Date() } } });
  }

  async softDeleteReplies(commentId: Types.ObjectId): Promise<number> {
    const result = await this.updateMany({ filter: { parentComment: commentId, ...ACTIVE }, data: { $set: { deletedAt: new Date() } } });
    return result.modifiedCount;
  }

  async changeCounter(commentId: Types.ObjectId, field: Counter, amount: 1 | -1): Promise<void> {
    await this.updateOne({
      filter: amount < 0 ? { _id: commentId, [field]: { $gt: 0 } } : { _id: commentId },
      data: { $inc: { [field]: amount } },
    });
  }
}

export const commentRepository = new CommentRepository();
