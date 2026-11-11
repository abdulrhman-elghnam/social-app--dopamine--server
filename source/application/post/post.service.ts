import type { JwtPayload } from 'jsonwebtoken';
import type { Types } from 'mongoose';

import { postRepository } from '../../database/repository/post.repository.js';
import { userRepository } from '../../database/repository/user.repository.js';
import type { HPostDocument } from '../../database/model/post.model.js';
import { ForbiddenException, NotFoundException } from '../../dependency/exception/main.exception.js';
import type { IHandlerResult } from '../../dependency/service/util.service.js';
import { utilService } from '../../dependency/service/util.service.js';
import type { CreatePostBody, GetPostsQuery, UpdatePostBody } from './dto/post.dto.js';

class PostService {
  private userId = (payload: JwtPayload) => utilService.toObjectId(payload.sub as string);

  findVisiblePost = async (postId: string, viewerId: Types.ObjectId): Promise<HPostDocument> => {
    const post = await postRepository.findVisibleById(utilService.toObjectId(postId), viewerId);
    if (!post) {
      throw new NotFoundException('Post not found', { messageCode: 906 });
    }
    return post;
  };

  private findOwnedPost = async (postId: string, ownerId: Types.ObjectId): Promise<HPostDocument> => {
    const post = await postRepository.findActiveById(utilService.toObjectId(postId));
    if (!post) {
      throw new NotFoundException('Post not found', { messageCode: 906 });
    }
    if (!post.author.equals(ownerId)) {
      throw new ForbiddenException('Not the post owner', { messageCode: 907 });
    }
    return post;
  };

  createPost = async (body: CreatePostBody, payload: JwtPayload): Promise<IHandlerResult> => {
    const author = this.userId(payload);

    const post = await postRepository.create({
      data: {
        author,
        content: body.content,
        ...(body.visibility !== undefined ? { visibility: body.visibility } : {}),
        ...(body.commentsEnabled !== undefined ? { commentsEnabled: body.commentsEnabled } : {}),
      } as never,
    });
    await userRepository.changePostsCount(author, 1);

    return { status: 201, messageCode: 901, data: post };
  };

  getMyPosts = async (query: GetPostsQuery, payload: JwtPayload): Promise<IHandlerResult> => {
    const { data, ...meta } = await postRepository.paginateByAuthor(this.userId(payload), query.page, query.size);

    return { messageCode: 902, data, meta };
  };

  getPost = async (postId: string, payload: JwtPayload): Promise<IHandlerResult> => {
    const post = await this.findVisiblePost(postId, this.userId(payload));
    await post.populate({ path: 'author', select: "firstName lastName username image" });

    return { messageCode: 903, data: post };
  };

  updatePost = async (postId: string, body: UpdatePostBody, payload: JwtPayload): Promise<IHandlerResult> => {
    const post = await this.findOwnedPost(postId, this.userId(payload));

    if (body.content !== undefined) post.content = body.content;
    if (body.visibility !== undefined) post.visibility = body.visibility;
    if (body.commentsEnabled !== undefined) post.commentsEnabled = body.commentsEnabled;
    post.editedAt = new Date();
    await post.save();

    return { messageCode: 904, data: post };
  };

  deletePost = async (postId: string, payload: JwtPayload): Promise<IHandlerResult> => {
    const owner = this.userId(payload);
    const post = await this.findOwnedPost(postId, owner);

    await postRepository.softDelete(post._id);
    await userRepository.changePostsCount(owner, -1);

    return { messageCode: 905 };
  };
}

export const postService = new PostService();
