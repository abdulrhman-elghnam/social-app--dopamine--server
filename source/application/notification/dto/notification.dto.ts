import { z } from 'zod';
import { idParams, paginationQuery } from '../../../dependency/pipe/common.dto.js';
import { ApiLanguage } from '../../../dependency/value/system.enum.js';

export class GetNotificationsDTO {
  static schema = (language: ApiLanguage) => ({
    query: paginationQuery(language).extend({
      unread: z
        .enum(['true', 'false'])
        .optional()
        .transform((value) => value === 'true'),
    }),
  });
}
export type GetNotificationsQuery = z.infer<ReturnType<typeof GetNotificationsDTO.schema>['query']>;

export class NotificationIdDTO {
  static schema = (language: ApiLanguage) => ({ params: idParams(language, 'id') });
}
export type NotificationIdParams = z.infer<ReturnType<typeof NotificationIdDTO.schema>['params']>;
