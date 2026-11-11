import type { JwtPayload } from 'jsonwebtoken';
import type { Types } from 'mongoose';

import type { HPostDocument } from '../../database/model/post.model.js';
import { likeRepository } from '../../database/repository/like.repository.js';
import { postRepository } from '../../database/repository/post.repository.js';
import { savedPostRepository } from '../../database/repository/save-post.repository.js';
import { shareRepository } from '../../database/repository/share.repository.js';
import { userRepository } from '../../database/repository/user.repository.js';
import { ForbiddenException, NotFoundException } from '../../dependency/exception/main.exception.js';
import type { IHandlerResult } from '../../dependency/service/util.service.js';
import { utilService } from '../../dependency/service/util.service.js';
import { NotificationTypeEnum, PostVisibilityEnum } from '../../dependency/value/database.enum.js';
import { AUTHOR_FIELDS } from '../../dependency/value/projection.value.js';
import { notificationService } from '../notification/notification.service.js';
import type { CreatePostBody, GetPostsQuery, SharePostBody, UpdatePostBody } from './dto/post.dto.js';

type PostLike = { _id?: Types.ObjectId | undefined };

class PostService {
  findVisiblePost = async (postId: string | Types.ObjectId, viewerId: Types.ObjectId): Promise<HPostDocument> => {
    const id = typeof postId === 'string' ? utilService.toObjectId(postId) : postId;
    const post = await postRepository.findVisibleById(id, viewerId);
    if (!post) throw new NotFoundException('Post not found', { messageCode: 906 });
    return post;
  };

  private findOwnedPost = async (postId: string, ownerId: Types.ObjectId): Promise<HPostDocument> => {
    const post = await postRepository.findActiveById(utilService.toObjectId(postId));
    if (!post) throw new NotFoundException('Post not found', { messageCode: 906 });
    if (!post.author.equals(ownerId)) throw new ForbiddenException('Not the post owner', { messageCode: 907 });
    return post;
  };

  /** Adds the viewer-specific `isLiked` / `isSaved` flags to a list of (lean) posts. */
  withViewerFlags = async <P extends PostLike>(posts: P[], viewerId: Types.ObjectId): Promise<Array<P & { isLiked: boolean; isSaved: boolean }>> => {
    const ids = posts.map((post) => post._id).filter((id): id is Types.ObjectId => Boolean(id));
    const [liked, saved] = await Promise.all([likeRepository.idsAmong(viewerId, ids), savedPostRepository.idsAmong(viewerId, ids)]);
    return posts.map((post) => ({ ...post, isLiked: liked.has(String(post._id)), isSaved: saved.has(String(post._id)) }));
  };

  createPost = async (body: CreatePostBody, payload: JwtPayload): Promise<IHandlerResult> => {
    const author = utilService.currentUserId(payload);

    const post = await postRepository.create({
      data: {
        author,
        content: body.content,
        ...(body.visibility !== undefined ? { visibility: body.visibility } : {}),
        ...(body.commentsEnabled !== undefined ? { commentsEnabled: body.commentsEnabled } : {}),
      },
    });
    await userRepository.changePostsCount(author, 1);

    return { status: 201, messageCode: 901, data: post };
  };

  getFeed = async (query: GetPostsQuery, payload: JwtPayload): Promise<IHandlerResult> => {
    const viewer = utilService.currentUserId(payload);
    const { data, meta } = utilService.paged(await postRepository.paginateFeed(viewer, query.page, query.size));
    return { messageCode: 912, data: await this.withViewerFlags(data, viewer), meta };
  };

  getPost = async (postId: string, payload: JwtPayload): Promise<IHandlerResult> => {
    const viewer = utilService.currentUserId(payload);
    const post = await this.findVisiblePost(postId, viewer);
    await post.populate({ path: 'author', select: AUTHOR_FIELDS });
    const [data] = await this.withViewerFlags([post.toObject()], viewer);
    return { messageCode: 903, data };
  };

  updatePost = async (postId: string, body: UpdatePostBody, payload: JwtPayload): Promise<IHandlerResult> => {
    const post = await this.findOwnedPost(postId, utilService.currentUserId(payload));

    if (body.content !== undefined) post.content = body.content;
    if (body.visibility !== undefined) post.visibility = body.visibility;
    if (body.commentsEnabled !== undefined) post.commentsEnabled = body.commentsEnabled;
    post.editedAt = new Date();
    await post.save();

    return { messageCode: 904, data: post };
  };

  deletePost = async (postId: string, payload: JwtPayload): Promise<IHandlerResult> => {
    const owner = utilService.currentUserId(payload);
    const post = await this.findOwnedPost(postId, owner);

    await postRepository.softDelete(post._id);
    await userRepository.changePostsCount(owner, -1);

    return { messageCode: 905 };
  };

  like = async (postId: string, payload: JwtPayload): Promise<IHandlerResult> => {
    const me = utilService.currentUserId(payload);
    const post = await this.findVisiblePost(postId, me);

    const created = await likeRepository.createIfAbsent({ user: me, post: post._id });
    if (created) {
      await postRepository.changeCounter(post._id, 'likesCount', 1);
      await notificationService.notify({ recipient: post.author, sender: me, type: NotificationTypeEnum.LIKE, post: post._id });
    }

    return { messageCode: 913, data: { postId: post._id, isLiked: true, likesCount: post.likesCount + (created ? 1 : 0) } };
  };

  unlike = async (postId: string, payload: JwtPayload): Promise<IHandlerResult> => {
    const me = utilService.currentUserId(payload);
    const post = await this.findVisiblePost(postId, me);

    const removed = await likeRepository.deleteIfPresent({ user: me, post: post._id });
    if (removed) {
      await postRepository.changeCounter(post._id, 'likesCount', -1);
      await notificationService.retract({ recipient: post.author, sender: me, type: NotificationTypeEnum.LIKE, post: post._id });
    }

    return { messageCode: 914, data: { postId: post._id, isLiked: false, likesCount: Math.max(0, post.likesCount - (removed ? 1 : 0)) } };
  };

  save = async (postId: string, payload: JwtPayload): Promise<IHandlerResult> => {
    const me = utilService.currentUserId(payload);
    const post = await this.findVisiblePost(postId, me);
    await savedPostRepository.createIfAbsent({ user: me, post: post._id });
    return { messageCode: 915, data: { postId: post._id, isSaved: true } };
  };

  unsave = async (postId: string, payload: JwtPayload): Promise<IHandlerResult> => {
    const me = utilService.currentUserId(payload);
    // No visibility check: you can always drop a post from your saved list, even if it became hidden.
    await savedPostRepository.deleteIfPresent({ user: me, post: utilService.toObjectId(postId) });
    return { messageCode: 916, data: { postId, isSaved: false } };
  };

  /** Re-shares a public post (or your own) with an optional caption. */
  share = async (postId: string, body: SharePostBody, payload: JwtPayload): Promise<IHandlerResult> => {
    const me = utilService.currentUserId(payload);
    const post = await this.findVisiblePost(postId, me);

    if (post.visibility !== PostVisibilityEnum.PUBLIC && !post.author.equals(me)) {
      throw new ForbiddenException('Only public posts can be shared', { messageCode: 919 });
    }

    const share = await shareRepository.create({
      data: { user: me, post: post._id, ...(body.content ? { content: body.content } : {}) },
    });
    await postRepository.changeCounter(post._id, 'sharesCount', 1);
    await notificationService.notify({ recipient: post.author, sender: me, type: NotificationTypeEnum.SHARE, post: post._id });

    return { status: 201, messageCode: 917, data: { share, sharesCount: post.sharesCount + 1 } };
  };
}

export const postService = new PostService();
