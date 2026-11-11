import { z } from 'zod';
import { ApiLanguage } from '../value/system.enum.js';
import { generalValidationFields, translator } from './validation.pipe.js';

/** `{ [name]: ObjectId }` params schema, e.g. `idParams(t, 'postId')`. */
export const idParams = <K extends string>(language: ApiLanguage, ...names: K[]) => {
  const t = translator(language);
  return z.object(
    Object.fromEntries(names.map((name) => [name, generalValidationFields.objectId(t)])) as Record<K, ReturnType<typeof generalValidationFields.objectId>>,
  );
};

/** `?page=&size=` query schema (defaults 1 and 10, size ≤ 50). */
export const paginationQuery = (language: ApiLanguage) => {
  const t = translator(language);
  return z.object({ page: generalValidationFields.page(t), size: generalValidationFields.size(t) });
};
export type PaginationQuery = z.infer<ReturnType<typeof paginationQuery>>;

/** Params + pagination, for "list the X of resource :id" routes. */
export const idWithPagination = <K extends string>(language: ApiLanguage, ...names: K[]) => ({
  params: idParams(language, ...names),
  query: paginationQuery(language),
});
