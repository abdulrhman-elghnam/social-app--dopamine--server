import { z } from 'zod';

import { idParams, idWithPagination, paginationQuery } from '../../../dependency/pipe/common.dto.js';
import { generalValidationFields, translator } from '../../../dependency/pipe/validation.pipe.js';
import type { Translate } from '../../../dependency/pipe/validation.pipe.js';
import { UserPrivacyControllerEnum } from '../../../dependency/value/database.enum.js';
import { ApiLanguage } from '../../../dependency/value/system.enum.js';

const namePart = (t: Translate, required: number, invalid: number) =>
  z
    .string({ message: t(required) })
    .trim()
    .min(2, { message: t(invalid) })
    .max(30, { message: t(invalid) })
    .regex(/^[\p{L}]+(?:[ '’-][\p{L}]+)*$/u, { message: t(invalid) });

/** PATCH /users/me — any subset of the editable profile fields. */
export class UpdateMeDTO {
  static schema = (language: ApiLanguage) => {
    const t = translator(language);

    return {
      body: z
        .strictObject({
          firstName: namePart(t, 218, 219).optional(),
          lastName: namePart(t, 220, 221).optional(),
          username: generalValidationFields.username(t).optional(),
          bio: z
            .string({ message: t(238) })
            .trim()
            .max(500, { message: t(244) })
            .optional(),
          phone: generalValidationFields.phoneNumber(t).optional(),
          DOB: generalValidationFields.DOB(t).optional(),
          gender: generalValidationFields.gender(t).optional(),
          privacyController: z.enum(UserPrivacyControllerEnum, { message: t(257) }).optional(),
        })
        .refine((data) => Object.values(data).some((value) => value !== undefined), { message: t(910) }),
    };
  };
}
export type UpdateMeBody = z.infer<ReturnType<typeof UpdateMeDTO.schema>['body']>;

/** GET /users/search?q=&page=&size= */
export class SearchUsersDTO {
  static schema = (language: ApiLanguage) => {
    const t = translator(language);
    return {
      query: paginationQuery(language).extend({
        q: z
          .string({ message: t(206) })
          .trim()
          .min(1, { message: t(237) })
          .max(50, { message: t(244) }),
      }),
    };
  };
}
export type SearchUsersQuery = z.infer<ReturnType<typeof SearchUsersDTO.schema>['query']>;

/** GET /users/suggestions?page=&size= */
export class SuggestUsersDTO {
  static schema = (language: ApiLanguage) => ({ query: paginationQuery(language) });
}
export type SuggestUsersQuery = z.infer<ReturnType<typeof SuggestUsersDTO.schema>['query']>;

/** GET /users/me/blocked?page=&size= */
export class BlockedUsersDTO {
  static schema = (language: ApiLanguage) => ({ query: paginationQuery(language) });
}
export type BlockedUsersQuery = z.infer<ReturnType<typeof BlockedUsersDTO.schema>['query']>;

/** /users/:userId, /users/:userId/block, /users/:userId/follow */
export class UserIdDTO {
  static schema = (language: ApiLanguage) => ({ params: idParams(language, 'userId') });
}
export type UserIdParams = z.infer<ReturnType<typeof UserIdDTO.schema>['params']>;

/** /users/:userId/followers | following | posts */
export class UserListDTO {
  static schema = (language: ApiLanguage) => idWithPagination(language, 'userId');
}
export type UserListQuery = z.infer<ReturnType<typeof UserListDTO.schema>['query']>;
