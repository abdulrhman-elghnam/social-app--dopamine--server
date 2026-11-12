import type { JwtPayload } from 'jsonwebtoken';
import type { Types } from 'mongoose';

import type { HCommentDocument } from '../../database/model/comment.model.js';
import { blockRepository } from '../../database/repository/block.repository.js';
import { commentLikeRepository } from '../../database/repository/comment-like.repository.js';
import { commentRepository } from '../../database/repository/comment.repository.js';
import { postRepository } from '../../database/repository/post.repository.js';
import type { HPostDocument } from '../../database/model/post.model.js';
import { ForbiddenException, NotFoundException } from '../../dependency/exception/main.exception.js';
import type { IHandlerResult } from '../../dependency/service/util.service.js';
import { utilService } from '../../dependency/service/util.service.js';
import { NotificationTypeEnum } from '../../dependency/value/database.enum.js';
import { AUTHOR_FIELDS } from '../../dependency/value/projection.value.js';
import { notificationService } from '../notification/notification.service.js';
import { postService } from '../post/post.service.js';
import type { CreateCommentBody, GetCommentsQuery, GetRepliesQuery, UpdateCommentBody } from './dto/comment.dto.js';

type CommentLike = { _id?: Types.ObjectId | undefined };

class CommentService {
  /** Active comment whose post the viewer can still see (otherwise 404, never 403 — don't leak existence). */
  private findAccessible = async (commentId: string, viewer: Types.ObjectId): Promise<{ comment: HCommentDocument; post: HPostDocument }> => {
    const comment = await commentRepository.findActiveById(utilService.toObjectId(commentId));
    if (!comment || (await blockRepository.isBlockedEither(viewer, comment.author))) {
      throw new NotFoundException('Comment not found', { messageCode: 926 });
    }
    const post = await postService.findVisiblePost(comment.post, viewer);
    return { comment, post };
  };

  private withLikeFlag = async <C extends CommentLike>(comments: C[], viewer: Types.ObjectId): Promise<Array<C & { isLiked: boolean }>> => {
    const ids = comments.map((comment) => comment._id).filter((id): id is Types.ObjectId => Boolean(id));
    const liked = await commentLikeRepository.idsAmong(viewer, ids);
    return comments.map((comment) => ({ ...comment, isLiked: liked.has(String(comment._id)) }));
  };

  create = async (postId: string, body: CreateCommentBody, payload: JwtPayload): Promise<IHandlerResult> => {
    const author = utilService.currentUserId(payload);
    const post = await postService.findVisiblePost(postId, author);

    if (!post.commentsEnabled) throw new ForbiddenException('Comments are disabled', { messageCode: 908 });

    // Replies are one level deep: replying to a reply attaches to its top-level comment.
    let parent: HCommentDocument | null = null;
    if (body.parentCommentId) {
      const target = await commentRepository.findActiveInPost(post._id, utilService.toObjectId(body.parentCommentId));
      if (!target) throw new NotFoundException('Parent comment not found', { messageCode: 933 });
      parent = target.parentComment ? await commentRepository.findActiveInPost(post._id, target.parentComment) : target;
      if (!parent) throw new NotFoundException('Parent comment not found', { messageCode: 933 });
    }

    const comment = await commentRepository.create({
      data: { post: post._id, author, content: body.content, ...(parent ? { parentComment: parent._id } : {}) },
    });
    await postRepository.changeCommentsCount(post._id, 1);

    if (parent) {
      await commentRepository.changeCounter(parent._id, 'repliesCount', 1);
      await notificationService.notify({ recipient: parent.author, sender: author, type: NotificationTypeEnum.REPLY, post: post._id, comment: comment._id });
    } else {
      await notificationService.notify({ recipient: post.author, sender: author, type: NotificationTypeEnum.COMMENT, post: post._id, comment: comment._id });
    }

    return { status: 201, messageCode: 921, data: comment };
  };

  listForPost = async (postId: string, query: GetCommentsQuery, payload: JwtPayload): Promise<IHandlerResult> => {
    const viewer = utilService.currentUserId(payload);
    const post = await postService.findVisiblePost(postId, viewer);
    const hidden = await blockRepository.hiddenUserIds(viewer);
    const { data, meta } = utilService.paged(await commentRepository.paginateByPost(post._id, query.page, query.size, hidden));
    return { messageCode: 922, data: await this.withLikeFlag(data, viewer), meta };
  };

  replies = async (commentId: string, query: GetRepliesQuery, payload: JwtPayload): Promise<IHandlerResult> => {
    const viewer = utilService.currentUserId(payload);
    const { comment } = await this.findAccessible(commentId, viewer);
    const hidden = await blockRepository.hiddenUserIds(viewer);
    const { data, meta } = utilService.paged(await commentRepository.paginateReplies(comment._id, query.page, query.size, hidden));
    return { messageCode: 932, data: await this.withLikeFlag(data, viewer), meta };
  };

  update = async (commentId: string, body: UpdateCommentBody, payload: JwtPayload): Promise<IHandlerResult> => {
    const me = utilService.currentUserId(payload);
    const { comment } = await this.findAccessible(commentId, me);

    if (!comment.author.equals(me)) throw new ForbiddenException('Not the comment owner', { messageCode: 927 });

    comment.content = body.content;
    comment.editedAt = new Date();
    await comment.save();
    await comment.populate({ path: 'author', select: AUTHOR_FIELDS });

    return { messageCode: 924, data: comment };
  };

  remove = async (commentId: string, payload: JwtPayload): Promise<IHandlerResult> => {
    const me = utilService.currentUserId(payload);
    const { comment, post } = await this.findAccessible(commentId, me);

    if (!comment.author.equals(me) && !post.author.equals(me)) {
      throw new ForbiddenException('Not the comment or post owner', { messageCode: 927 });
    }

    await commentRepository.softDelete(comment._id);
    const removedReplies = comment.parentComment ? 0 : await commentRepository.softDeleteReplies(comment._id);
    await postRepository.decrementCounterBy(post._id, 'commentsCount', 1 + removedReplies);
    if (comment.parentComment) await commentRepository.changeCounter(comment.parentComment, 'repliesCount', -1);

    return { messageCode: 925, data: { commentId: comment._id, removedReplies } };
  };

  like = async (commentId: string, payload: JwtPayload): Promise<IHandlerResult> => {
    const me = utilService.currentUserId(payload);
    const { comment, post } = await this.findAccessible(commentId, me);

    const created = await commentLikeRepository.createIfAbsent({ user: me, comment: comment._id });
    if (created) {
      await commentRepository.changeCounter(comment._id, 'likesCount', 1);
      await notificationService.notify({
        recipient: comment.author,
        sender: me,
        type: NotificationTypeEnum.COMMENT_LIKE,
        post: post._id,
        comment: comment._id,
      });
    }

    return { messageCode: 930, data: { commentId: comment._id, isLiked: true, likesCount: comment.likesCount + (created ? 1 : 0) } };
  };

  unlike = async (commentId: string, payload: JwtPayload): Promise<IHandlerResult> => {
    const me = utilService.currentUserId(payload);
    const { comment } = await this.findAccessible(commentId, me);

    const removed = await commentLikeRepository.deleteIfPresent({ user: me, comment: comment._id });
    if (removed) {
      await commentRepository.changeCounter(comment._id, 'likesCount', -1);
      await notificationService.retract({ recipient: comment.author, sender: me, type: NotificationTypeEnum.COMMENT_LIKE, comment: comment._id });
    }

    return { messageCode: 931, data: { commentId: comment._id, isLiked: false, likesCount: Math.max(0, comment.likesCount - (removed ? 1 : 0)) } };
  };
}

export const commentService = new CommentService();
