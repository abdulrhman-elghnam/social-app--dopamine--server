import { Router } from 'express';
import type { Request, Router as RouterType } from 'express';
import type { JwtPayload } from 'jsonwebtoken';

import { authGuard } from '../../dependency/guard/auth.guard.js';
import { validationPipe } from '../../dependency/pipe/validation.pipe.js';
import { utilService } from '../../dependency/service/util.service.js';
import { TokenTypeEnum } from '../../dependency/value/security.enum.js';
import {
  CommentIdDTO,
  CreateCommentDTO,
  GetCommentsDTO,
  UpdateCommentDTO,
  type CommentIdParams,
  type CommentPostParams,
  type CreateCommentBody,
  type GetCommentsQuery,
  type UpdateCommentBody,
} from './dto/comment.dto.js';
import { commentService } from './comment.service.js';

/** Mounted at `/post/:postId/comment` — `mergeParams` exposes `postId` from the parent path. */
class CommentController {
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
      validationPipe.schema(CreateCommentDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) =>
          commentService.createComment(
            (req.validated!.params as CommentPostParams).postId,
            req.validated!.body as CreateCommentBody,
            req.payload as JwtPayload,
          ),
      }),
    );

    this.route.get(
      '/',
      authGuard.check(TokenTypeEnum.ACCESS),
      validationPipe.schema(GetCommentsDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) =>
          commentService.getPostComments(
            (req.validated!.params as CommentPostParams).postId,
            req.validated!.query as GetCommentsQuery,
            req.payload as JwtPayload,
          ),
      }),
    );

    this.route.get(
      '/:commentId',
      authGuard.check(TokenTypeEnum.ACCESS),
      validationPipe.schema(CommentIdDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) => commentService.getComment(req.validated!.params as CommentIdParams, req.payload as JwtPayload),
      }),
    );

    this.route.patch(
      '/:commentId',
      authGuard.check(TokenTypeEnum.ACCESS),
      validationPipe.schema(UpdateCommentDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) =>
          commentService.updateComment(req.validated!.params as CommentIdParams, req.validated!.body as UpdateCommentBody, req.payload as JwtPayload),
      }),
    );

    this.route.delete(
      '/:commentId',
      authGuard.check(TokenTypeEnum.ACCESS),
      validationPipe.schema(CommentIdDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) => commentService.deleteComment(req.validated!.params as CommentIdParams, req.payload as JwtPayload),
      }),
    );
  }
}

export const commentController = new CommentController();
