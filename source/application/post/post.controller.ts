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
  UpdatePostDTO,
  type CreatePostBody,
  type GetPostsQuery,
  type PostIdParams,
  type UpdatePostBody,
} from './dto/post.dto.js';
import { postService } from './post.service.js';

class PostController {
  public readonly route: RouterType;

  constructor() {
    this.route = Router({
      caseSensitive: true,
      strict: true,
      mergeParams: true,
    });
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.route.post(
      '/',
      authGuard.check(TokenTypeEnum.ACCESS),
      validationPipe.schema(CreatePostDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) => postService.createPost(req.validated!.body as CreatePostBody, req.payload as JwtPayload),
      }),
    );

    this.route.get(
      '/',
      authGuard.check(TokenTypeEnum.ACCESS),
      validationPipe.schema(GetPostsDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) => postService.getMyPosts(req.validated!.query as GetPostsQuery, req.payload as JwtPayload),
      }),
    );

    this.route.get(
      '/:postId',
      authGuard.check(TokenTypeEnum.ACCESS),
      validationPipe.schema(PostIdDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) => postService.getPost((req.validated!.params as PostIdParams).postId, req.payload as JwtPayload),
      }),
    );

    this.route.patch(
      '/:postId',
      authGuard.check(TokenTypeEnum.ACCESS),
      validationPipe.schema(UpdatePostDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) =>
          postService.updatePost((req.validated!.params as PostIdParams).postId, req.validated!.body as UpdatePostBody, req.payload as JwtPayload),
      }),
    );

    this.route.delete(
      '/:postId',
      authGuard.check(TokenTypeEnum.ACCESS),
      validationPipe.schema(PostIdDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) => postService.deletePost((req.validated!.params as PostIdParams).postId, req.payload as JwtPayload),
      }),
    );
  }
}

export const postController = new PostController();
