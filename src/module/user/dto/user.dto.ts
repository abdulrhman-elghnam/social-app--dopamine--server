import { z } from 'zod';
import { generalValidationFields } from '../../../dep/pipe/validation.pipe.js';
import { languageService } from '../../../dep/service/language.service.js';
import { ApiLanguage } from '../../../dep/value/system.enum.js';

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
}

export const userDTO = new UserDTO();
