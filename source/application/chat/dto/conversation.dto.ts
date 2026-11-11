import { z } from 'zod';

import { idParams, idWithPagination, paginationQuery } from '../../../dependency/pipe/common.dto.js';
import { generalValidationFields, translator } from '../../../dependency/pipe/validation.pipe.js';
import type { Translate } from '../../../dependency/pipe/validation.pipe.js';
import { ApiLanguage } from '../../../dependency/value/system.enum.js';

const userIds = (t: Translate, max = 50) =>
  z
    .array(generalValidationFields.objectId(t), { message: t(241) })
    .min(1, { message: t(256) })
    .max(max, { message: t(255) });
const groupName = (t: Translate) =>
  z
    .string({ message: t(238) })
    .trim()
    .min(1, { message: t(237) })
    .max(50, { message: t(244) });
const groupImage = (t: Translate) => z.url({ message: t(248) });

/** Direct chat: `participantIds: [otherUserId]`. Group: `isGroup: true`, a name and ≥ 2 others. */
export class CreateConversationDTO {
  static schema = (language: ApiLanguage) => {
    const t = translator(language);
    return {
      body: z
        .strictObject({
          participantIds: userIds(t),
          isGroup: z.boolean({ message: t(240) }).default(false),
          groupName: groupName(t).optional(),
          groupImage: groupImage(t).optional(),
        })
        .refine((data) => (data.isGroup ? Boolean(data.groupName) && new Set(data.participantIds).size >= 2 : new Set(data.participantIds).size === 1), {
          message: t(1214),
        }),
    };
  };
}
export type CreateConversationBody = z.infer<ReturnType<typeof CreateConversationDTO.schema>['body']>;

export class ConversationIdDTO {
  static schema = (language: ApiLanguage) => ({ params: idParams(language, 'id') });
}
export type ConversationIdParams = z.infer<ReturnType<typeof ConversationIdDTO.schema>['params']>;

export class ListConversationsDTO {
  static schema = (language: ApiLanguage) => ({ query: paginationQuery(language) });
}
export type ListConversationsQuery = z.infer<ReturnType<typeof ListConversationsDTO.schema>['query']>;

export class UpdateGroupDTO {
  static schema = (language: ApiLanguage) => {
    const t = translator(language);
    return {
      params: idParams(language, 'id'),
      body: z
        .strictObject({
          groupName: groupName(t).optional(),
          groupImage: groupImage(t).optional(),
          addMembers: userIds(t).optional(),
          removeMembers: userIds(t).optional(),
        })
        .refine((data) => Object.values(data).some((value) => value !== undefined), { message: t(910) }),
    };
  };
}
export type UpdateGroupBody = z.infer<ReturnType<typeof UpdateGroupDTO.schema>['body']>;

export class GetMessagesDTO {
  static schema = (language: ApiLanguage) => idWithPagination(language, 'id');
}
export type GetMessagesQuery = z.infer<ReturnType<typeof GetMessagesDTO.schema>['query']>;

export class MuteConversationDTO {
  static schema = (language: ApiLanguage) => {
    const t = translator(language);
    return { params: idParams(language, 'id'), body: z.strictObject({ muted: z.boolean({ message: t(240) }) }) };
  };
}
export type MuteConversationBody = z.infer<ReturnType<typeof MuteConversationDTO.schema>['body']>;

/** Without `messageId`, marks everything up to the latest message as read. */
export class ReadConversationDTO {
  static schema = (language: ApiLanguage) => {
    const t = translator(language);
    return { params: idParams(language, 'id'), body: z.strictObject({ messageId: generalValidationFields.objectId(t).optional() }) };
  };
}
export type ReadConversationBody = z.infer<ReturnType<typeof ReadConversationDTO.schema>['body']>;
