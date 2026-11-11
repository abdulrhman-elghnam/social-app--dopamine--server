import { Router } from 'express';
import type { Request, Response, NextFunction, Router as RouterType } from 'express';
import { validationPipe } from '../../dependency/pipe/validation.pipe.js';

import { utilService } from '../../dependency/service/util.service.js';
import { ChangePasswordDTO, EmailDTO, GoogleSignUpDTO, LoginDTO, OtpDTO, RefreshTokenDTO, SignupDTO } from './dto/authentication.dto.js';
import { authService } from './authentication.service.js';

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
      validationPipe.schema(SignupDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request, _res: Response, _next: NextFunction) => authService.signup(req.body)
      }),
    );

    this.route.post(
      '/login',
      validationPipe.schema(LoginDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request, _res: Response, _next: NextFunction) =>  authService.login(req.body, utilService.issuer(req))
      }),
    );

    this.route.post(
      '/google-signup',
      validationPipe.schema(GoogleSignUpDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request, _res: Response, _next: NextFunction) => authService.googleCredential(req.body, utilService.issuer(req))
      }),
    );

    this.route.post(
      '/verify-otp',
      validationPipe.schema(OtpDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request, _res: Response, _next: NextFunction) =>  authService.verifyOtp(req.body)
      }),
    );

    this.route.post(
      '/forgot-password',
      validationPipe.schema(EmailDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) => authService.requestForgetPassword(req.body),
      }),
    );

    this.route.post(
      '/verify-forgot-password',
      validationPipe.schema(OtpDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) => authService.verifyForgotPassword(req.body),
      }),
    );

    this.route.post(
      '/change-password',
      validationPipe.schema(ChangePasswordDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) => authService.changePassword(req.body),
      }),
    );

    this.route.post(
      '/rotate-token',
      validationPipe.schema(RefreshTokenDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) => authService.rotateToken(req.body, utilService.issuer(req)),
      }),
    );
  }
}

export const authenticationController = new AuthenticationController();
