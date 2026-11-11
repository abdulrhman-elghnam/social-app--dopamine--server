import { z } from 'zod';
import { ApiLanguage } from '../value/system.enum.js';
import { generalValidationFields, translator } from './validation.pipe.js';


export const idParams = <K extends string>(language: ApiLanguage, ...names: K[]) => {
  const t = translator(language);
  return z.object(
    Object.fromEntries(names.map((name) => [name, generalValidationFields.objectId(t)])) as Record<K, ReturnType<typeof generalValidationFields.objectId>>,
  );
};


export const paginationQuery = (language: ApiLanguage) => {
  const t = translator(language);
  return z.object({ page: generalValidationFields.page(t), size: generalValidationFields.size(t) });
};
export type PaginationQuery = z.infer<ReturnType<typeof paginationQuery>>;


export const idWithPagination = <K extends string>(language: ApiLanguage, ...names: K[]) => ({
  params: idParams(language, ...names),
  query: paginationQuery(language),
});
