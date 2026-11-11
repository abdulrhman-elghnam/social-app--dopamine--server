import { UnauthorizedException } from '../exception/main.exception.js';
import type { Request, Response, NextFunction } from 'express';
import { SystemRoleEnum, TokenTypeEnum } from '../value/security.enum.js';
import { tokenService } from '../service/token.service.js';

class AuthGuard {
  constructor() {}
  check = (tokenType: TokenTypeEnum) => {
    return async (req: Request, _res: Response, next: NextFunction) => {
      const authorization = req.headers.authorization;

      if (!authorization) {
        throw new UnauthorizedException('Authentication required', {
          messageCode: 109,
        });
      }

      const payload = await tokenService.decodeToken(authorization, tokenType);
      req.user = {
        role: payload.aud?.[1] as SystemRoleEnum,
      };
      req.payload = payload;

      next();
    };
  };
}
export const authGuard = new AuthGuard();
