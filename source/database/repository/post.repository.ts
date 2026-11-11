import type { Types } from 'mongoose';
import { PostModel } from '../model/post.model.js';
import type { HPostDocument } from '../model/post.model.js';
import type { IPost } from '../../dependency/interface/database.interface.js';
import { PostVisibilityEnum } from '../../dependency/value/database.enum.js';
import { DatabaseRepository } from './base.repository.js';
import { followRepository } from './follow.repository.js';


export class PostRepository extends DatabaseRepository<IPost> {
  constructor() {
    super(PostModel);
  }

  /** Non-deleted post by id, or null. */
  async findActiveById(postId: Types.ObjectId): Promise<HPostDocument | null> {
    return this.findOne({ filter: { _id: postId, deletedAt: { $exists: false } } });
  }

  /** Non-deleted post the viewer may see (author, public, or follower of a followers-only post), or null. */
  async findVisibleById(postId: Types.ObjectId, viewerId: Types.ObjectId): Promise<HPostDocument | null> {
    const post = await this.findActiveById(postId);
    if (!post) return null;

    if (post.author.equals(viewerId) || post.visibility === PostVisibilityEnum.PUBLIC) return post;

    if (post.visibility === PostVisibilityEnum.FOLLOWERS && (await followRepository.isFollowing(viewerId, post.author))) return post;

    return null;
  }

  /** Author's non-deleted posts, newest first, with the author populated. */
  async paginateByAuthor(authorId: Types.ObjectId, page: number, size: number) {
    return this.paginate({
      filter: { author: authorId, deletedAt: { $exists: false } },
      options: { sort: { createdAt: -1 }, populate: { path: 'author', select: "firstName lastName username image" }, lean: true },
      page,
      size,
    });
  }

  async softDelete(postId: Types.ObjectId): Promise<void> {
    await this.updateOne({ filter: { _id: postId }, data: { $set: { deletedAt: new Date() } } });
  }

  /** Adjusts commentsCount by ±1 without going below zero. */
  async changeCommentsCount(postId: Types.ObjectId, amount: 1 | -1): Promise<void> {
    await this.updateOne({
      filter: amount < 0 ? { _id: postId, commentsCount: { $gt: 0 } } : { _id: postId },
      data: { $inc: { commentsCount: amount } },
    });
  }
}

export const postRepository = new PostRepository();
