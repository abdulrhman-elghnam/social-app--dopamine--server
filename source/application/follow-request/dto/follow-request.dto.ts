import { z } from 'zod';
import { idParams, paginationQuery } from '../../../dependency/pipe/common.dto.js';
import { ApiLanguage } from '../../../dependency/value/system.enum.js';

export class SendFollowRequestDTO {
  static schema = (language: ApiLanguage) => ({ params: idParams(language, 'userId') });
}
export type SendFollowRequestParams = z.infer<ReturnType<typeof SendFollowRequestDTO.schema>['params']>;

export class FollowRequestIdDTO {
  static schema = (language: ApiLanguage) => ({ params: idParams(language, 'requestId') });
}
export type FollowRequestIdParams = z.infer<ReturnType<typeof FollowRequestIdDTO.schema>['params']>;

export class ListFollowRequestsDTO {
  static schema = (language: ApiLanguage) => ({ query: paginationQuery(language) });
}
export type ListFollowRequestsQuery = z.infer<ReturnType<typeof ListFollowRequestsDTO.schema>['query']>;
