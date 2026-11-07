import { Router } from 'express';
import type { Request, Response, NextFunction, Router as RouterType } from 'express';
import { validationPipe } from '../../dep/pipe/validation.pipe.js';

import { utilService } from '../../dep/service/util.service.js';
import { authDTO } from './dto/auth.dto.js';
import { authService } from './auth.service.js';

export class AuthenticationController {
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
      '/signup',
      validationPipe.schema(authDTO.signupDTO),
      utilService.responseFormatter({
        handler: (req: Request, _res: Response, _next: NextFunction) => {
          console.log('test');

          return authService.signup(req.body);
        },
      })
    );

    this.route.post(
      '/login',
      validationPipe.schema(authDTO.loginDTO),
      utilService.responseFormatter({
        handler: (req: Request, _res: Response, _next: NextFunction) => {
          return authService.login(req.body, utilService.issuer(req));
        },
      })
    );

    this.route.post(
      '/google-signup',
      validationPipe.schema(authDTO.googleSignUpDTO),
      utilService.responseFormatter({
        handler: (req: Request, _res: Response, _next: NextFunction) => {
          return authService.googleCredential(req.body, utilService.issuer(req));
        },
      })
    );

    this.route.post(
      '/verify-otp',
      validationPipe.schema(authDTO.otpDTO),
      utilService.responseFormatter({
        handler: (req: Request, _res: Response, _next: NextFunction) => {
          return authService.verifyOtp(req.body);
        },
      })
    );

    this.route.post(
      '/forgot-password',
      validationPipe.schema(authDTO.emailDTO),
      utilService.responseFormatter({
        handler: (req: Request) => authService.requestForgetPassword(req.body),
      })
    );

    this.route.post(
      '/verify-forgot-password',
      validationPipe.schema(authDTO.otpDTO),
      utilService.responseFormatter({
        handler: (req: Request) => authService.verifyForgotPassword(req.body),
      })
    );

    this.route.post(
      '/change-password',
      validationPipe.schema(authDTO.changePasswordDTO),
      utilService.responseFormatter({
        handler: (req: Request) => authService.changePassword(req.body),
      })
    );

    this.route.post(
      '/rotate-token',
      validationPipe.schema(authDTO.refreshTokenDTO),
      utilService.responseFormatter({
        handler: (req: Request) => authService.rotateToken(req.body, utilService.issuer(req)),
      })
    );
  }
}

export const authenticationController = new AuthenticationController();
