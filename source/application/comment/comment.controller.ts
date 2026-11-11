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
  GetRepliesDTO,
  UpdateCommentDTO,
  type CommentIdParams,
  type CommentPostParams,
  type CreateCommentBody,
  type GetCommentsQuery,
  type GetRepliesQuery,
  type UpdateCommentBody,
} from './dto/comment.dto.js';
import { commentService } from './comment.service.js';

const auth = authGuard.check(TokenTypeEnum.ACCESS);
const commentId = (req: Request) => (req.validated!.params as CommentIdParams).commentId;

/** Mounted at `/posts/:postId/comments` — `mergeParams` exposes `postId` from the parent path. */
class PostCommentController {
  public readonly route: RouterType = Router({ caseSensitive: true, strict: true, mergeParams: true });

  constructor() {
    this.route.post(
      '/',
      auth,
      validationPipe.schema(CreateCommentDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) =>
          commentService.create((req.validated!.params as CommentPostParams).postId, req.validated!.body as CreateCommentBody, req.payload as JwtPayload),
      }),
    );

    this.route.get(
      '/',
      auth,
      validationPipe.schema(GetCommentsDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) =>
          commentService.listForPost((req.validated!.params as CommentPostParams).postId, req.validated!.query as GetCommentsQuery, req.payload as JwtPayload),
      }),
    );
  }
}

/** Mounted at `/comments` — operations addressed by comment id alone. */
class CommentController {
  public readonly route: RouterType = Router({ caseSensitive: true, strict: true });

  constructor() {
    this.route.patch(
      '/:commentId',
      auth,
      validationPipe.schema(UpdateCommentDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) => commentService.update(commentId(req), req.validated!.body as UpdateCommentBody, req.payload as JwtPayload),
      }),
    );

    this.route.delete(
      '/:commentId',
      auth,
      validationPipe.schema(CommentIdDTO.schema),
      utilService.responseFormatter({ handler: (req: Request) => commentService.remove(commentId(req), req.payload as JwtPayload) }),
    );

    this.route.post(
      '/:commentId/like',
      auth,
      validationPipe.schema(CommentIdDTO.schema),
      utilService.responseFormatter({ handler: (req: Request) => commentService.like(commentId(req), req.payload as JwtPayload) }),
    );

    this.route.delete(
      '/:commentId/like',
      auth,
      validationPipe.schema(CommentIdDTO.schema),
      utilService.responseFormatter({ handler: (req: Request) => commentService.unlike(commentId(req), req.payload as JwtPayload) }),
    );

    this.route.get(
      '/:commentId/replies',
      auth,
      validationPipe.schema(GetRepliesDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) => commentService.replies(commentId(req), req.validated!.query as GetRepliesQuery, req.payload as JwtPayload),
      }),
    );
  }
}

export const postCommentController = new PostCommentController();
export const commentController = new CommentController();
