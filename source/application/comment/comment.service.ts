import type { JwtPayload } from 'jsonwebtoken';
import type { Types } from 'mongoose';

import { commentRepository } from '../../database/repository/comment.repository.js';
import { postRepository } from '../../database/repository/post.repository.js';

import type { HCommentDocument } from '../../database/model/comment.model.js';
import { ForbiddenException, NotFoundException } from '../../dependency/exception/main.exception.js';
import type { IHandlerResult } from '../../dependency/service/util.service.js';
import { utilService } from '../../dependency/service/util.service.js';
import { postService } from '../post/post.service.js';
import type { CommentIdParams, CreateCommentBody, GetCommentsQuery, UpdateCommentBody } from './dto/comment.dto.js';

class CommentService {
  private userId = (payload: JwtPayload) => utilService.toObjectId(payload.sub as string);


  private findComment = async (postId: Types.ObjectId, commentId: string): Promise<HCommentDocument> => {
    const comment = await commentRepository.findActiveInPost(postId, utilService.toObjectId(commentId));
    if (!comment) {
      throw new NotFoundException('Comment not found', { messageCode: 926 });
    }
    return comment;
  };

  createComment = async (postId: string, body: CreateCommentBody, payload: JwtPayload): Promise<IHandlerResult> => {
    const author = this.userId(payload);
    const post = await postService.findVisiblePost(postId, author);

    if (!post.commentsEnabled) {
      throw new ForbiddenException('Comments are disabled', { messageCode: 908 });
    }

    const comment = await commentRepository.create({
      data: { post: post._id, author, content: body.content } as never,
    });
    await postRepository.changeCommentsCount(post._id, 1);

    return { status: 201, messageCode: 921, data: comment };
  };

  getPostComments = async (postId: string, query: GetCommentsQuery, payload: JwtPayload): Promise<IHandlerResult> => {
    const post = await postService.findVisiblePost(postId, this.userId(payload));
    const { data, ...meta } = await commentRepository.paginateByPost(post._id, query.page, query.size);

    return { messageCode: 922, data, meta };
  };

  getComment = async (params: CommentIdParams, payload: JwtPayload): Promise<IHandlerResult> => {
    const post = await postService.findVisiblePost(params.postId, this.userId(payload));
    const comment = await this.findComment(post._id, params.commentId);
    await comment.populate({ path: 'author', select: "firstName lastName username image" });

    return { messageCode: 923, data: comment };
  };

  updateComment = async (params: CommentIdParams, body: UpdateCommentBody, payload: JwtPayload): Promise<IHandlerResult> => {
    const userId = this.userId(payload);
    const post = await postService.findVisiblePost(params.postId, userId);
    const comment = await this.findComment(post._id, params.commentId);

    if (!comment.author.equals(userId)) {
      throw new ForbiddenException('Not the comment owner', { messageCode: 927 });
    }

    comment.content = body.content;
    comment.editedAt = new Date();
    await comment.save();

    return { messageCode: 924, data: comment };
  };

  /** Comment owner or post owner may delete. */
  deleteComment = async (params: CommentIdParams, payload: JwtPayload): Promise<IHandlerResult> => {
    const userId = this.userId(payload);
    const post = await postService.findVisiblePost(params.postId, userId);
    const comment = await this.findComment(post._id, params.commentId);

    if (!comment.author.equals(userId) && !post.author.equals(userId)) {
      throw new ForbiddenException('Not the comment or post owner', { messageCode: 927 });
    }

    await commentRepository.softDelete(comment._id);
    await postRepository.changeCommentsCount(post._id, -1);

    return { messageCode: 925 };
  };
}

export const commentService = new CommentService();
