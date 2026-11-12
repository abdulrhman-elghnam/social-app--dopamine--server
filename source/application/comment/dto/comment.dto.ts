import { z } from 'zod';

import { idParams, paginationQuery } from '../../../dependency/pipe/common.dto.js';
import { generalValidationFields, translator } from '../../../dependency/pipe/validation.pipe.js';
import type { Translate } from '../../../dependency/pipe/validation.pipe.js';
import { ApiLanguage } from '../../../dependency/value/system.enum.js';

const commentContent = (t: Translate) =>
  z
    .string({ message: t(928) })
    .trim()
    .min(1, { message: t(928) })
    .max(2000, { message: t(929) });

export class CreateCommentDTO {
  static schema = (language: ApiLanguage) => {
    const t = translator(language);

    return {
      params: idParams(language, 'postId'),
      body: z.strictObject({
        content: commentContent(t),
        parentCommentId: generalValidationFields.objectId(t).optional(),
      }),
    };
  };
}
export type CreateCommentBody = z.infer<ReturnType<typeof CreateCommentDTO.schema>['body']>;
export type CommentPostParams = z.infer<ReturnType<typeof CreateCommentDTO.schema>['params']>;

export class GetCommentsDTO {
  static schema = (language: ApiLanguage) => ({
    params: idParams(language, 'postId'),
    query: paginationQuery(language),
  });
}
export type GetCommentsQuery = z.infer<ReturnType<typeof GetCommentsDTO.schema>['query']>;

export class CommentIdDTO {
  static schema = (language: ApiLanguage) => ({ params: idParams(language, 'commentId') });
}
export type CommentIdParams = z.infer<ReturnType<typeof CommentIdDTO.schema>['params']>;

export class UpdateCommentDTO {
  static schema = (language: ApiLanguage) => ({
    params: idParams(language, 'commentId'),
    body: z.strictObject({ content: commentContent(translator(language)) }),
  });
}
export type UpdateCommentBody = z.infer<ReturnType<typeof UpdateCommentDTO.schema>['body']>;

export class GetRepliesDTO {
  static schema = (language: ApiLanguage) => ({
    params: idParams(language, 'commentId'),
    query: paginationQuery(language),
  });
}
export type GetRepliesQuery = z.infer<ReturnType<typeof GetRepliesDTO.schema>['query']>;
