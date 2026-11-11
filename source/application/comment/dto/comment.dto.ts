import { z } from 'zod';

import { generalValidationFields, translator } from '../../../dependency/pipe/validation.pipe.js';
import type { Translate } from '../../../dependency/pipe/validation.pipe.js';
import { ApiLanguage } from '../../../dependency/value/system.enum.js';

const commentContent = (t: Translate) =>
  z
    .string({ message: t(928) })
    .trim()
    .min(1, { message: t(928) })
    .max(2000, { message: t(929) });

const postIdParams = (t: Translate) =>
  z.object({
    postId: generalValidationFields.objectId(t),
  });

const commentIdParams = (t: Translate) =>
  z.object({
    postId: generalValidationFields.objectId(t),
    commentId: generalValidationFields.objectId(t),
  });

export class CreateCommentDTO {
  static schema = (language: ApiLanguage) => {
    const t = translator(language);

    return {
      params: postIdParams(t),
      body: z.strictObject({
        content: commentContent(t),
      }),
    };
  };
}
export type CreateCommentBody = z.infer<ReturnType<typeof CreateCommentDTO.schema>['body']>;
export type CommentPostParams = z.infer<ReturnType<typeof CreateCommentDTO.schema>['params']>;

export class GetCommentsDTO {
  static schema = (language: ApiLanguage) => {
    const t = translator(language);

    return {
      params: postIdParams(t),
      query: z.object({
        page: generalValidationFields.page(t),
        size: generalValidationFields.size(t),
      }),
    };
  };
}
export type GetCommentsQuery = z.infer<ReturnType<typeof GetCommentsDTO.schema>['query']>;

export class CommentIdDTO {
  static schema = (language: ApiLanguage) => ({
    params: commentIdParams(translator(language)),
  });
}
export type CommentIdParams = z.infer<ReturnType<typeof CommentIdDTO.schema>['params']>;

export class UpdateCommentDTO {
  static schema = (language: ApiLanguage) => {
    const t = translator(language);

    return {
      params: commentIdParams(t),
      body: z.strictObject({
        content: commentContent(t),
      }),
    };
  };
}
export type UpdateCommentBody = z.infer<ReturnType<typeof UpdateCommentDTO.schema>['body']>;
