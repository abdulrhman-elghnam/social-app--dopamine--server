import { z } from 'zod';

import { generalValidationFields, translator } from '../../../dependency/pipe/validation.pipe.js';
import type { Translate } from '../../../dependency/pipe/validation.pipe.js';
import { PostVisibilityEnum } from '../../../dependency/value/database.enum.js';
import { ApiLanguage } from '../../../dependency/value/system.enum.js';

const postFields = {
  content: (t: Translate) =>
    z
      .string({ message: t(909) })
      .trim()
      .min(1, { message: t(909) })
      .max(5000, { message: t(911) }),
  visibility: (t: Translate) => z.enum(PostVisibilityEnum, { message: t(257) }),
  commentsEnabled: (t: Translate) => z.boolean({ message: t(240) }),
};

const postIdParams = (t: Translate) =>
  z.object({
    postId: generalValidationFields.objectId(t),
  });

export class CreatePostDTO {
  static schema = (language: ApiLanguage) => {
    const t = translator(language);

    return {
      body: z.strictObject({
        content: postFields.content(t),
        visibility: postFields.visibility(t).optional(),
        commentsEnabled: postFields.commentsEnabled(t).optional(),
      }),
    };
  };
}
export type CreatePostBody = z.infer<ReturnType<typeof CreatePostDTO.schema>['body']>;

export class GetPostsDTO {
  static schema = (language: ApiLanguage) => {
    const t = translator(language);

    return {
      query: z.object({
        page: generalValidationFields.page(t),
        size: generalValidationFields.size(t),
      }),
    };
  };
}
export type GetPostsQuery = z.infer<ReturnType<typeof GetPostsDTO.schema>['query']>;

export class PostIdDTO {
  static schema = (language: ApiLanguage) => ({
    params: postIdParams(translator(language)),
  });
}
export type PostIdParams = z.infer<ReturnType<typeof PostIdDTO.schema>['params']>;

export class UpdatePostDTO {
  static schema = (language: ApiLanguage) => {
    const t = translator(language);

    return {
      params: postIdParams(t),
      body: z
        .strictObject({
          content: postFields.content(t).optional(),
          visibility: postFields.visibility(t).optional(),
          commentsEnabled: postFields.commentsEnabled(t).optional(),
        })
        .refine((data) => Object.values(data).some((value) => value !== undefined), {
          message: t(910),
        }),
    };
  };
}
export type UpdatePostBody = z.infer<ReturnType<typeof UpdatePostDTO.schema>['body']>;
