import type { QueryFilter, Types } from 'mongoose';
import { PostModel } from '../model/post.model.js';
import type { HPostDocument } from '../model/post.model.js';
import type { IPost } from '../../dependency/interface/database.interface.js';
import { PostVisibilityEnum } from '../../dependency/value/database.enum.js';
import { AUTHOR_FIELDS } from '../../dependency/value/projection.value.js';
import { DatabaseRepository } from './base.repository.js';
import { blockRepository } from './block.repository.js';
import { followRepository } from './follow.repository.js';
import type { AuthorCard } from '../../dependency/value/projection.value.js';

type Counter = 'likesCount' | 'commentsCount' | 'sharesCount';
const ACTIVE = { deletedAt: { $exists: false } } as const;
const populateAuthor = { path: 'author', select: AUTHOR_FIELDS };

export class PostRepository extends DatabaseRepository<IPost> {
  constructor() {
    super(PostModel);
  }

  /** Non-deleted post by id, or null. */
  async findActiveById(postId: Types.ObjectId): Promise<HPostDocument | null> {
    return this.findOne({ filter: { _id: postId, ...ACTIVE } });
  }

  /**
   * Non-deleted post the viewer may see, or null: never when either side blocked the other;
   * otherwise the author, any public post, or a follower for followers-only posts.
   */
  async findVisibleById(postId: Types.ObjectId, viewerId: Types.ObjectId): Promise<HPostDocument | null> {
    const post = await this.findActiveById(postId);
    if (!post) return null;
    if (post.author.equals(viewerId)) return post;
    if (await blockRepository.isBlockedEither(viewerId, post.author)) return null;
    if (post.visibility === PostVisibilityEnum.PUBLIC) return post;
    if (post.visibility === PostVisibilityEnum.FOLLOWERS && (await followRepository.isFollowing(viewerId, post.author))) return post;
    return null;
  }

  /** Home feed: the viewer's own posts plus public/followers posts from people they follow. */
  async paginateFeed(viewerId: Types.ObjectId, page: number, size: number) {
    const [followingIds, hiddenIds] = await Promise.all([followRepository.followingIds(viewerId), blockRepository.hiddenUserIds(viewerId)]);
    const visibleFollowing = followingIds.filter((id) => !hiddenIds.includes(id));
    const filter: QueryFilter<IPost> = {
      ...ACTIVE,
      $or: [{ author: viewerId }, { author: { $in: visibleFollowing }, visibility: { $in: [PostVisibilityEnum.PUBLIC, PostVisibilityEnum.FOLLOWERS] } }],
    };
    return this.paginateLean<{ author: AuthorCard }>({ filter, options: { sort: { createdAt: -1 }, populate: populateAuthor }, page, size });
  }

  /** One author's posts as seen by the viewer (own: all; follower: public+followers; others: public). */
  async paginateByAuthorFor(authorId: Types.ObjectId, viewerId: Types.ObjectId, isFollower: boolean, page: number, size: number) {
    const visibility = authorId.equals(viewerId)
      ? Object.values(PostVisibilityEnum)
      : isFollower
        ? [PostVisibilityEnum.PUBLIC, PostVisibilityEnum.FOLLOWERS]
        : [PostVisibilityEnum.PUBLIC];
    return this.paginateLean<{ author: AuthorCard }>({
      filter: { author: authorId, ...ACTIVE, visibility: { $in: visibility } },
      options: { sort: { createdAt: -1 }, populate: populateAuthor },
      page,
      size,
    });
  }

  async softDelete(postId: Types.ObjectId): Promise<void> {
    await this.updateOne({ filter: { _id: postId }, data: { $set: { deletedAt: new Date() } } });
  }

  /** Adjusts a counter by ±1 without going below zero. */
  async changeCounter(postId: Types.ObjectId, field: Counter, amount: 1 | -1): Promise<void> {
    await this.updateOne({
      filter: amount < 0 ? { _id: postId, [field]: { $gt: 0 } } : { _id: postId },
      data: { $inc: { [field]: amount } },
    });
  }

  /** Lowers a counter by `by` (e.g. a comment plus its replies), clamping at zero. */
  async decrementCounterBy(postId: Types.ObjectId, field: Counter, by: number): Promise<void> {
    if (by <= 0) return;
    const result = await this.updateOne({ filter: { _id: postId, [field]: { $gte: by } }, data: { $inc: { [field]: -by } } });
    if (result.matchedCount === 0) await this.updateOne({ filter: { _id: postId }, data: { $set: { [field]: 0 } } });
  }

  async changeCommentsCount(postId: Types.ObjectId, amount: 1 | -1): Promise<void> {
    await this.changeCounter(postId, 'commentsCount', amount);
  }
}

export const postRepository = new PostRepository();
