import { Router } from 'express';
import type { Request, Router as RouterType } from 'express';
import type { JwtPayload } from 'jsonwebtoken';

import { authGuard } from '../../dependency/guard/auth.guard.js';
import { validationPipe } from '../../dependency/pipe/validation.pipe.js';
import { utilService } from '../../dependency/service/util.service.js';
import { TokenTypeEnum } from '../../dependency/value/security.enum.js';
import {
  CreatePostDTO,
  GetPostsDTO,
  PostIdDTO,
  SharePostDTO,
  UpdatePostDTO,
  type CreatePostBody,
  type GetPostsQuery,
  type PostIdParams,
  type SharePostBody,
  type UpdatePostBody,
} from './dto/post.dto.js';
import { postService } from './post.service.js';

/** Mounted at `/posts`. Comments of a post live in the comment module (`/posts/:postId/comments`). */
class PostController {
  public readonly route: RouterType = Router({ caseSensitive: true, strict: true });

  constructor() {
    const auth = authGuard.check(TokenTypeEnum.ACCESS);
    const postId = (req: Request) => (req.validated!.params as PostIdParams).postId;

    this.route.post(
      '/',
      auth,
      validationPipe.schema(CreatePostDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) => postService.createPost(req.validated!.body as CreatePostBody, req.payload as JwtPayload),
      }),
    );

    this.route.get(
      '/',
      auth,
      validationPipe.schema(GetPostsDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) => postService.getFeed(req.validated!.query as GetPostsQuery, req.payload as JwtPayload),
      }),
    );

    this.route.get(
      '/:postId',
      auth,
      validationPipe.schema(PostIdDTO.schema),
      utilService.responseFormatter({ handler: (req: Request) => postService.getPost(postId(req), req.payload as JwtPayload) }),
    );

    this.route.patch(
      '/:postId',
      auth,
      validationPipe.schema(UpdatePostDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) => postService.updatePost(postId(req), req.validated!.body as UpdatePostBody, req.payload as JwtPayload),
      }),
    );

    this.route.delete(
      '/:postId',
      auth,
      validationPipe.schema(PostIdDTO.schema),
      utilService.responseFormatter({ handler: (req: Request) => postService.deletePost(postId(req), req.payload as JwtPayload) }),
    );

    this.route.post(
      '/:postId/like',
      auth,
      validationPipe.schema(PostIdDTO.schema),
      utilService.responseFormatter({ handler: (req: Request) => postService.like(postId(req), req.payload as JwtPayload) }),
    );

    this.route.delete(
      '/:postId/like',
      auth,
      validationPipe.schema(PostIdDTO.schema),
      utilService.responseFormatter({ handler: (req: Request) => postService.unlike(postId(req), req.payload as JwtPayload) }),
    );

    this.route.post(
      '/:postId/save',
      auth,
      validationPipe.schema(PostIdDTO.schema),
      utilService.responseFormatter({ handler: (req: Request) => postService.save(postId(req), req.payload as JwtPayload) }),
    );

    this.route.delete(
      '/:postId/save',
      auth,
      validationPipe.schema(PostIdDTO.schema),
      utilService.responseFormatter({ handler: (req: Request) => postService.unsave(postId(req), req.payload as JwtPayload) }),
    );

    this.route.post(
      '/:postId/share',
      auth,
      validationPipe.schema(SharePostDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) => postService.share(postId(req), req.validated!.body as SharePostBody, req.payload as JwtPayload),
      }),
    );
  }
}

export const postController = new PostController();
