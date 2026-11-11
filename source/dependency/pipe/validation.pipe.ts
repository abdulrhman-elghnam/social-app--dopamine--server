import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { z } from 'zod';
import { BadRequestException } from '../exception/main.exception.js';
import { ApiLanguage } from '../value/system.enum.js';
import { languageService } from '../service/language.service.js';

interface ValidationSchema {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
  file?: ZodType;
  files?: ZodType;
}

type SchemaFactory = (language: ApiLanguage) => ValidationSchema;
export type Translate = (code: number) => string;

export const translator =
  (language: ApiLanguage | string): Translate =>
  (code) =>
    languageService.chooseLanguage(language, code);

export class ValidationPipe {
  constructor() {}

  schema = (schema: SchemaFactory): RequestHandler => {
    return (req, res, next) => {
      try {
        const language = req.get('accept-language') ?? ApiLanguage.ENGLISH;
        const validationSchema = schema(language as ApiLanguage);

        const result = z
          .object({
            body: validationSchema.body ?? z.object({}),
            params: validationSchema.params ?? z.object({}),
            query: validationSchema.query ?? z.object({}),
            file: validationSchema.file ?? z.unknown().optional(),
            files: validationSchema.files ?? z.unknown().optional(),
          })
          .safeParse({
            body: req.body ?? {},
            params: req.params,
            query: req.query,
            file: req.file,
            files: req.files,
          });

        if (!result.success) {
          return next(
            new BadRequestException('Validation failed', {
              messageCode: 201,
              extra: result.error.issues.map(({ path, code, message }) => ({
                path,
                code,
                message,
              })),
            }),
          );
        }

        req.body = result.data.body;

        req.validated = {
          body: result.data.body,
          params: result.data.params,
          query: result.data.query,
          file: result.data.file,
          files: result.data.files,
        };

        return next();
      } catch (error) {
        return next(error);
      }
    };
  };
}

export const generalValidationFields = {
  email: (t: Translate) =>
    z
      .string({ message: t(208) })
      .trim()
      .min(1, { message: t(208) })
      .email({ message: t(209) })
      .toLowerCase(),

  username: (t: Translate) =>
    z
      .string({ message: t(210) })
      .trim()
      .min(3, { message: t(211) })
      .max(30, { message: t(211) })
      .regex(/^[a-zA-Z0-9_]+$/, { message: t(211) }),

  password: (t: Translate) =>
    z
      .string({ message: t(212) })
      .min(8, { message: t(214) })
      .max(30, { message: t(215) })
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/, {
        message: t(213),
      }),

  confirmPassword: (t: Translate) => z.string({ message: t(216) }).min(1, { message: t(216) }),

  fullName: (t: Translate) =>
    z
      .string({ message: t(222) })
      .trim()
      .min(3, { message: t(223) })
      .max(30, { message: t(223) })
      .regex(/^[\p{L}]+(?:[ '\u2019-][\p{L}]+)*$/u, {
        message: t(223),
      }),

  gender: (t: Translate) =>
    z.enum(['MALE', 'FEMALE'], {
      message: t(228),
    }),

  phoneNumber: (t: Translate) =>
    z
      .string({ message: t(229) })
      .trim()
      .regex(/^(?:\+201|01)[0125]\d{8}$/, {
        message: t(230),
      }),

  DOB: (t: Translate) =>
    z.coerce
      .date({ message: t(225) })
      .refine(
        (date) => {
          const today = new Date();
          const minDate = new Date();
          minDate.setFullYear(today.getFullYear() - 100);

          return date >= minDate && date <= today;
        },
        { message: t(227) },
      )
      .refine(
        (date) => {
          const maxDate = new Date();
          maxDate.setFullYear(new Date().getFullYear() - 18);

          return date <= maxDate;
        },
        { message: t(226) },
      ),
  otp: (t: Translate) =>
    z
      .string({ message: t(235) })
      .trim()
      .regex(/^\d{6}$/, { message: t(236) }),

  idToken: (t: Translate) =>
    z
      .string({ message: t(234) })
      .trim()
      .min(1, { message: t(234) }),

  objectId: (t: Translate) =>
    z
      .string({ message: t(259) })
      .trim()
      .regex(/^[a-f\d]{24}$/i, { message: t(259) }),

  page: (t: Translate) =>
    z.coerce
      .number({ message: t(260) })
      .int({ message: t(260) })
      .min(1, { message: t(260) })
      .default(1),

  size: (t: Translate) =>
    z.coerce
      .number({ message: t(261) })
      .int({ message: t(261) })
      .min(1, { message: t(261) })
      .max(50, { message: t(261) })
      .default(10),

  privacyAction: (t: Translate) =>
    z.enum(['public', 'private'], {
      message: t(237),
    }),
};

export const validationPipe = new ValidationPipe();
