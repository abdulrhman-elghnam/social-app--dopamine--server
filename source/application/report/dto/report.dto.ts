import { z } from 'zod';

import { idParams, paginationQuery } from '../../../dependency/pipe/common.dto.js';
import { generalValidationFields, translator } from '../../../dependency/pipe/validation.pipe.js';
import { ReportStatusEnum, ReportTargetTypeEnum } from '../../../dependency/value/database.enum.js';
import { ApiLanguage } from '../../../dependency/value/system.enum.js';

export class CreateReportDTO {
  static schema = (language: ApiLanguage) => {
    const t = translator(language);
    return {
      body: z.strictObject({
        targetType: z.enum(ReportTargetTypeEnum, { message: t(257) }),
        targetId: generalValidationFields.objectId(t),
        reason: z
          .string({ message: t(206) })
          .trim()
          .min(3, { message: t(243) })
          .max(100, { message: t(244) }),
        description: z
          .string({ message: t(238) })
          .trim()
          .max(1000, { message: t(244) })
          .optional(),
      }),
    };
  };
}
export type CreateReportBody = z.infer<ReturnType<typeof CreateReportDTO.schema>['body']>;

export class ListReportsDTO {
  static schema = (language: ApiLanguage) => {
    const t = translator(language);
    return {
      query: paginationQuery(language).extend({
        status: z.enum(ReportStatusEnum, { message: t(257) }).optional(),
        targetType: z.enum(ReportTargetTypeEnum, { message: t(257) }).optional(),
      }),
    };
  };
}
export type ListReportsQuery = z.infer<ReturnType<typeof ListReportsDTO.schema>['query']>;

export class ReportIdDTO {
  static schema = (language: ApiLanguage) => ({ params: idParams(language, 'id') });
}
export type ReportIdParams = z.infer<ReturnType<typeof ReportIdDTO.schema>['params']>;

/** An admin moves a report out of `pending`. */
export class ReviewReportDTO {
  static schema = (language: ApiLanguage) => {
    const t = translator(language);
    return {
      params: idParams(language, 'id'),
      body: z.strictObject({
        status: z.enum([ReportStatusEnum.REVIEWED, ReportStatusEnum.RESOLVED, ReportStatusEnum.REJECTED], { message: t(257) }),
      }),
    };
  };
}
export type ReviewReportBody = z.infer<ReturnType<typeof ReviewReportDTO.schema>['body']>;
