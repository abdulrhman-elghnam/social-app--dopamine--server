import { Router } from 'express';
import type { Request, RequestHandler, Router as RouterType } from 'express';
import type { JwtPayload } from 'jsonwebtoken';

import { authGuard } from '../../dependency/guard/auth.guard.js';
import { uploadPipe } from '../../dependency/pipe/upload.pipe.js';
import { rateLimits } from '../../dependency/guard/limiter.guard.js';
import { validationPipe } from '../../dependency/pipe/validation.pipe.js';
import { fileFieldValidation, storageService } from '../../dependency/service/storage.service.js';
import { utilService } from '../../dependency/service/util.service.js';
import { TokenTypeEnum } from '../../dependency/value/security.enum.js';
import {
  SearchUsersDTO,
  SuggestUsersDTO,
  UpdateMeDTO,
  UserIdDTO,
  UserListDTO,
  type SearchUsersQuery,
  type SuggestUsersQuery,
  type UpdateMeBody,
  type UserIdParams,
  type UserListQuery,
} from './dto/user.dto.js';
import { userService } from './user.service.js';


const imageUpload = (fieldName: string, folder: string): RequestHandler =>
  uploadPipe.uploadMiddleware({
    multerMiddleware: storageService.localFileStorage({ maxFileSize: 5, validation: fileFieldValidation.image, customPath: folder }).single(fieldName),
    customPath: folder,
    validation: fileFieldValidation.image,
  });


class UserController {
  public readonly route: RouterType = Router({ caseSensitive: true, strict: true });

  constructor() {
    const auth = authGuard.check(TokenTypeEnum.ACCESS);
    const userId = (req: Request) => (req.validated!.params as UserIdParams).userId;

    this.route.get('/me', auth, utilService.responseFormatter({ handler: (req: Request) => userService.getMe(req.payload as JwtPayload) }));

    this.route.patch(
      '/me',
      auth,
      validationPipe.schema(UpdateMeDTO.schema),
      utilService.responseFormatter({ handler: (req: Request) => userService.updateMe(req.validated!.body as UpdateMeBody, req.payload as JwtPayload) }),
    );

    this.route.patch(
      '/me/avatar',
      auth,
      rateLimits.upload,
      imageUpload('avatar', 'avatars'),
      utilService.responseFormatter({
        handler: (req: Request) => userService.changeImage('image', req.file as Express.Multer.File, req.payload as JwtPayload),
      }),
    );

    this.route.patch(
      '/me/cover-image',
      auth,
      rateLimits.upload,
      imageUpload('coverImage', 'cover-images'),
      utilService.responseFormatter({
        handler: (req: Request) => userService.changeImage('coverImage', req.file as Express.Multer.File, req.payload as JwtPayload),
      }),
    );

    this.route.get(
      '/search',
      auth,
      validationPipe.schema(SearchUsersDTO.schema),
      utilService.responseFormatter({ handler: (req: Request) => userService.search(req.validated!.query as SearchUsersQuery, req.payload as JwtPayload) }),
    );

    this.route.get(
      '/suggestions',
      auth,
      validationPipe.schema(SuggestUsersDTO.schema),
      utilService.responseFormatter({ handler: (req: Request) => userService.suggest(req.validated!.query as SuggestUsersQuery, req.payload as JwtPayload) }),
    );

    this.route.get(
      '/:userId',
      auth,
      validationPipe.schema(UserIdDTO.schema),
      utilService.responseFormatter({ handler: (req: Request) => userService.getProfile(userId(req), req.payload as JwtPayload) }),
    );

    for (const list of ['followers', 'following', 'posts'] as const) {
      this.route.get(
        `/:userId/${list}`,
        auth,
        validationPipe.schema(UserListDTO.schema),
        utilService.responseFormatter({
          handler: (req: Request) => userService[list](userId(req), req.validated!.query as UserListQuery, req.payload as JwtPayload),
        }),
      );
    }

    this.route.post(
      '/:userId/block',
      auth,
      validationPipe.schema(UserIdDTO.schema),
      utilService.responseFormatter({ handler: (req: Request) => userService.block(userId(req), req.payload as JwtPayload) }),
    );

    this.route.delete(
      '/:userId/block',
      auth,
      validationPipe.schema(UserIdDTO.schema),
      utilService.responseFormatter({ handler: (req: Request) => userService.unblock(userId(req), req.payload as JwtPayload) }),
    );

    this.route.delete(
      '/:userId/follow',
      auth,
      validationPipe.schema(UserIdDTO.schema),
      utilService.responseFormatter({ handler: (req: Request) => userService.unfollow(userId(req), req.payload as JwtPayload) }),
    );
  }
}

export const userController = new UserController();
