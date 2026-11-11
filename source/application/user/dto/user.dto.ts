import { z } from 'zod';
import { generalValidationFields } from '../../../dependency/pipe/validation.pipe.js';
import { languageService } from '../../../dependency/service/language.service.js';
import { ApiLanguage } from '../../../dependency/value/system.enum.js';

export class UserDTO {
  constructor() {}

  privacyChangeDTO = (language: ApiLanguage) => {
    const t = (code: number) => languageService.chooseLanguage(language, code);

    return {
      body: z.object({
        action: generalValidationFields.privacyAction(t),
      }),
      params: z.object({}),
      query: z.object({}),
    };
  };

  bioUpdateDTO = (_language: ApiLanguage) => ({
    body: z.object({
      bio: z.string().trim().max(500),
    }),
    params: z.object({}),
    query: z.object({}),
  });
}

export const userDTO = new UserDTO();
