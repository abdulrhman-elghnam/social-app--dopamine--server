import { z } from 'zod';

import { generalValidationFields, translator } from '../../../dependency/pipe/validation.pipe.js';
import { ApiLanguage } from '../../../dependency/value/system.enum.js';

export class SignupDTO {
  static schema = (language: ApiLanguage) => {
    const t = translator(language);

    return {
      body: z
        .object({
          email: generalValidationFields.email(t),
          username: generalValidationFields.username(t),
          password: generalValidationFields.password(t),
          confirmPassword: generalValidationFields.confirmPassword(t),
          fullName: generalValidationFields.fullName(t),
          gender: generalValidationFields.gender(t),
          phoneNumber: generalValidationFields.phoneNumber(t),
          DOB: generalValidationFields.DOB(t),
        })
        .refine((data) => data.password === data.confirmPassword, {
          path: ['confirmPassword'],
          message: t(250),
        }),
    };
  };
}
export type SignupBody = z.infer<ReturnType<typeof SignupDTO.schema>['body']>;

export class LoginDTO {
  static schema = (language: ApiLanguage) => {
    const t = translator(language);

    return {
      body: z.object({
        email: generalValidationFields.email(t),
        password: generalValidationFields.password(t),
      }),
    };
  };
}
export type LoginBody = z.infer<ReturnType<typeof LoginDTO.schema>['body']>;

export class GoogleSignUpDTO {
  static schema = (language: ApiLanguage) => {
    const t = translator(language);

    return {
      body: z.object({
        idToken: generalValidationFields.idToken(t),
      }),
    };
  };
}
export type GoogleSignUpBody = z.infer<ReturnType<typeof GoogleSignUpDTO.schema>['body']>;

export class OtpDTO {
  static schema = (language: ApiLanguage) => {
    const t = translator(language);

    return {
      body: z.object({
        email: generalValidationFields.email(t),
        otp: generalValidationFields.otp(t),
      }),
    };
  };
}
export type OtpBody = z.infer<ReturnType<typeof OtpDTO.schema>['body']>;

export class EmailDTO {
  static schema = (language: ApiLanguage) => {
    const t = translator(language);

    return {
      body: z.object({
        email: generalValidationFields.email(t),
      }),
    };
  };
}
export type EmailBody = z.infer<ReturnType<typeof EmailDTO.schema>['body']>;

export class ChangePasswordDTO {
  static schema = (language: ApiLanguage) => {
    const t = translator(language);

    return {
      body: z
        .object({
          email: generalValidationFields.email(t),
          password: generalValidationFields.password(t),
          confirmPassword: generalValidationFields.confirmPassword(t),
        })
        .refine((data) => data.password === data.confirmPassword, {
          path: ['confirmPassword'],
          message: t(250),
        }),
    };
  };
}
export type ChangePasswordBody = z.infer<ReturnType<typeof ChangePasswordDTO.schema>['body']>;

export class RefreshTokenDTO {
  static schema = (_language: ApiLanguage) => ({
    body: z.object({
      refreshToken: z.string().trim().min(1),
    }),
  });
}
export type RefreshTokenBody = z.infer<ReturnType<typeof RefreshTokenDTO.schema>['body']>;
