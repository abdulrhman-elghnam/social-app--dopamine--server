import { Router } from 'express';
import type { Request, Router as RouterType } from 'express';
import type { JwtPayload } from 'jsonwebtoken';

import { authGuard } from '../../dependency/guard/auth.guard.js';
import { validationPipe } from '../../dependency/pipe/validation.pipe.js';
import { utilService } from '../../dependency/service/util.service.js';
import { TokenTypeEnum } from '../../dependency/value/security.enum.js';
import { authService } from './authentication.service.js';
import {
  ChangePasswordDTO,
  EmailDTO,
  GoogleSignUpDTO,
  LoginDTO,
  LogoutDTO,
  OtpDTO,
  RefreshTokenDTO,
  SignupDTO,
  type ChangePasswordBody,
  type EmailBody,
  type GoogleSignUpBody,
  type LoginBody,
  type LogoutBody,
  type OtpBody,
  type RefreshTokenBody,
  type SignupBody,
} from './dto/authentication.dto.js';

/**
 * Mounted at `/auth`. Spec routes: register, login, logout, refresh.
 * Account flows kept from before: verify-otp, google, forgot-password, verify-forgot-password, change-password.
 */
export class AuthenticationController {
  public readonly route: RouterType = Router({ caseSensitive: true, strict: true });

  constructor() {
    this.route.post(
      '/register',
      validationPipe.schema(SignupDTO.schema),
      utilService.responseFormatter({ handler: (req: Request) => authService.signup(req.validated!.body as SignupBody) }),
    );

    this.route.post(
      '/login',
      validationPipe.schema(LoginDTO.schema),
      utilService.responseFormatter({ handler: (req: Request) => authService.login(req.validated!.body as LoginBody, utilService.issuer(req)) }),
    );

    this.route.post(
      '/logout',
      authGuard.check(TokenTypeEnum.ACCESS),
      validationPipe.schema(LogoutDTO.schema),
      utilService.responseFormatter({ handler: (req: Request) => authService.logout(req.validated!.body as LogoutBody, req.payload as JwtPayload) }),
    );

    this.route.post(
      '/refresh',
      validationPipe.schema(RefreshTokenDTO.schema),
      utilService.responseFormatter({ handler: (req: Request) => authService.rotateToken(req.validated!.body as RefreshTokenBody, utilService.issuer(req)) }),
    );

    this.route.post(
      '/verify-otp',
      validationPipe.schema(OtpDTO.schema),
      utilService.responseFormatter({ handler: (req: Request) => authService.verifyOtp(req.validated!.body as OtpBody) }),
    );

    this.route.post(
      '/google',
      validationPipe.schema(GoogleSignUpDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) => authService.googleCredential(req.validated!.body as GoogleSignUpBody, utilService.issuer(req)),
      }),
    );

    this.route.post(
      '/forgot-password',
      validationPipe.schema(EmailDTO.schema),
      utilService.responseFormatter({ handler: (req: Request) => authService.requestForgetPassword(req.validated!.body as EmailBody) }),
    );

    this.route.post(
      '/verify-forgot-password',
      validationPipe.schema(OtpDTO.schema),
      utilService.responseFormatter({ handler: (req: Request) => authService.verifyForgotPassword(req.validated!.body as OtpBody) }),
    );

    this.route.post(
      '/change-password',
      validationPipe.schema(ChangePasswordDTO.schema),
      utilService.responseFormatter({ handler: (req: Request) => authService.changePassword(req.validated!.body as ChangePasswordBody) }),
    );
  }
}

export const authenticationController = new AuthenticationController();
