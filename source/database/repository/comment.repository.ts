import type { Types } from 'mongoose';
import { CommentModel } from '../model/comment.model.js';
import type { HCommentDocument } from '../model/comment.model.js';
import type { IComment } from '../../dependency/interface/database.interface.js';
import { DatabaseRepository } from './base.repository.js';


export class CommentRepository extends DatabaseRepository<IComment> {
  constructor() {
    super(CommentModel);
  }

  /** Non-deleted comment that belongs to the given post, or null. */
  async findActiveInPost(postId: Types.ObjectId, commentId: Types.ObjectId): Promise<HCommentDocument | null> {
    return this.findOne({ filter: { _id: commentId, post: postId, deletedAt: { $exists: false } } });
  }

  /** Post's non-deleted comments, newest first, with the author populated. */
  async paginateByPost(postId: Types.ObjectId, page: number, size: number) {
    return this.paginate({
      filter: { post: postId, deletedAt: { $exists: false } },
      options: { sort: { createdAt: -1 }, populate: { path: 'author', select: "firstName lastName username image" }, lean: true },
      page,
      size,
    });
  }

  async softDelete(commentId: Types.ObjectId): Promise<void> {
    await this.updateOne({ filter: { _id: commentId }, data: { $set: { deletedAt: new Date() } } });
  }
}

export const commentRepository = new CommentRepository();
