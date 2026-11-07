import { Router } from 'express';
import type { Request, Response, NextFunction, Router as RouterType } from 'express';
import { userService } from './user.service.js';
import { authGuard } from '../../dep/guard/auth.guard.js';
import { SystemRoleEnum, TokenTypeEnum } from '../../dep/value/security.enum.js';
import { JwtPayload } from 'jsonwebtoken';
import { roleGuard } from '../../dep/guard/role.guard.js';
import { utilService } from '../../dep/service/util.service.js';
import { userRepository } from '../../db/repo/user.repository.js';
import { uploadService, fileFieldValidation } from '../../dep/service/upload.service.js';
import { uploadPipe } from '../../dep/pipe/upload.pipe.js';

class UserController {
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
    this.route.get(
      '/profile',
      authGuard.check(TokenTypeEnum.ACCESS),
      utilService.responseFormatter({
        handler: async (req: Request, res: Response, next: NextFunction) => {
          const user = await userRepository.findById(
            utilService.toObjectId(req.payload?.sub as string)
          );
          return {
            messageCode: 200,
            data: user,
          };
        },
      })
    );

    this.route.put(
      '/change-privacy',
      authGuard.check(TokenTypeEnum.ACCESS),
      roleGuard.access([SystemRoleEnum.USER]),
      utilService.responseFormatter({
        handler: async (req: Request, res: Response, next: NextFunction) => {
          return await userService.changePrivacy(req.body, req.payload as JwtPayload);
        },
      })
    );

    this.route.put(
      '/change-avatar',
      authGuard.check(TokenTypeEnum.ACCESS),
      roleGuard.access([SystemRoleEnum.USER]),
      uploadPipe.uploadMiddleware({
        multerMiddleware: uploadService
          .localFileUpload({
            maxFileSize: 5,
            validation: fileFieldValidation.image,
            customPath: 'avatars',
          })
          .single('avatar'),
        customPath: 'avatars',
        validation: fileFieldValidation.image,
      }),
      utilService.responseFormatter({
        handler: async (req: Request, res: Response, next: NextFunction) => {
          return await userService.changeAvatar(
            req.file as Express.Multer.File,
            req.payload as JwtPayload
          );
        },
      })
    );

    this.route.get(
      '/search/:search{/:page}{/:size}',
      authGuard.check(TokenTypeEnum.ACCESS),
      utilService.responseFormatter({
        handler: async (req: Request, res: Response, next: NextFunction) => {
          const page = Number(req.params['page'] ?? 1);
          const size = Number(req.params['size'] ?? 10);
          const searchParam = req.params['search'];
          const search = Array.isArray(searchParam) ? (searchParam[0] ?? '') : (searchParam ?? '');

          return await userService.search(
            search,
            Number.isInteger(page) && page > 0 ? page : 1,
            Number.isInteger(size) && size > 0 ? size : 10
          );
        },
      })
    );

    this.route.get(
      '/suggestions{/:page}{/:size}',
      authGuard.check(TokenTypeEnum.ACCESS),
      utilService.responseFormatter({
        handler: async (req: Request) => {
          const page = Number(req.params['page'] ?? 1);
          const size = Number(req.params['size'] ?? 10);

          return await userService.suggest(
            req.payload as JwtPayload,
            Number.isInteger(page) && page > 0 ? page : 1,
            Number.isInteger(size) && size > 0 ? size : 10
          );
        },
      })
    );
  }
}

export const userController = new UserController();
