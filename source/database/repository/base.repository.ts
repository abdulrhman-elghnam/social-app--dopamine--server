import {
  HydratedDocument,
  InsertManyOptions,
  Model,
  PopulateOptions,
  ProjectionType,
  Query,
  QueryFilter,
  SaveOptions,
  Types,
  UpdateQuery,
  UpdateResult,
  UpdateWithAggregationPipeline,
} from 'mongoose';

export type RepositoryPopulate = string | string[] | PopulateOptions | PopulateOptions[];

export interface IRepositoryOptions<T> {
  select?: ProjectionType<T>;
  populate?: RepositoryPopulate;
  sort?: string | Record<string, 1 | -1 | 'asc' | 'desc'>;
  skip?: number;
  limit?: number;
  lean?: boolean;
}

export interface ILeanRepositoryOptions<T> extends IRepositoryOptions<T> {
  lean: true;
}

export interface IHydratedRepositoryOptions<T> extends IRepositoryOptions<T> {
  lean?: false;
}

export interface ICreateOptions {
  data: unknown;
  options?: object;
}

export interface ICreateManyOptions {
  data: unknown[];
  options?: InsertManyOptions;
}

export interface IRepositoryFindOptions<T> {
  filter?: QueryFilter<T>;
  options?: IRepositoryOptions<T>;
}

export interface IRepositoryUpdateOptions<T> {
  filter: QueryFilter<T>;
  data: UpdateQuery<T> | UpdateWithAggregationPipeline;
  options?: {
    upsert?: boolean;
    runValidators?: boolean;
    strict?: boolean;
  };
}

export interface IRepositoryFindAndUpdateOptions<T> {
  filter: QueryFilter<T>;
  data: UpdateQuery<T> | UpdateWithAggregationPipeline;
  options?: IRepositoryOptions<T> & {
    new?: boolean;
    upsert?: boolean;
    runValidators?: boolean;
    returnDocument?: 'before' | 'after';
  };
}

export interface IRepositoryPaginateOptions<T> {
  filter?: QueryFilter<T>;
  options?: IRepositoryOptions<T>;
  page?: number;
  size?: number;
}

/** A lean document whose `P` keys were replaced by `populate` (lean results always carry `_id`). */
export type Populated<T, P extends object = object> = Omit<T, keyof P | '_id'> & P & { _id: Types.ObjectId };

export interface IRepositoryPaginateResult<T> {
  data: T[];
  totalDocuments: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export abstract class DatabaseRepository<T> {
  protected constructor(protected readonly model: Model<T>) {}

  private applyFindOptions<R, D>(query: Query<R, D>, options?: IRepositoryOptions<T>): Query<R, D> {
    if (!options) return query;

    if (options.select !== undefined) {
      query = query.select(options.select);
    }

    if (options.populate !== undefined) {
      if (typeof options.populate === 'string') {
        query = query.populate(options.populate);
      } else if (Array.isArray(options.populate)) {
        query = query.populate(options.populate as (string | PopulateOptions)[]);
      } else {
        query = query.populate(options.populate);
      }
    }

    if (options.sort !== undefined) {
      query = query.sort(options.sort);
    }

    if (options.skip !== undefined) {
      query = query.skip(options.skip);
    }

    if (options.limit !== undefined) {
      query = query.limit(options.limit);
    }

    return query;
  }

  private addVersionIncrement(update: UpdateQuery<T> | UpdateWithAggregationPipeline): UpdateQuery<T> | UpdateWithAggregationPipeline {
    if (Array.isArray(update)) {
      return [
        ...update,
        {
          $set: {
            __v: {
              $add: [{ $ifNull: ['$__v', 0] }, 1],
            },
          },
        },
      ] as UpdateWithAggregationPipeline;
    }

    const updateObject = update as Record<string, unknown>;

    const currentIncrement = updateObject['$inc'];

    const increment =
      currentIncrement && typeof currentIncrement === 'object' && !Array.isArray(currentIncrement) ? (currentIncrement as Record<string, number>) : {};

    return {
      ...updateObject,
      $inc: {
        ...increment,
        __v: 1,
      },
    } as UpdateQuery<T>;
  }

  /**
   * `data` may omit fields Mongoose fills in (`_id`, timestamps, schema defaults such as counters);
   * the schema's `required` rules are still enforced at runtime.
   */
  async create({ data, options }: { data: Partial<T>; options?: object }): Promise<HydratedDocument<T>> {
    const document = options === undefined ? await this.model.create(data as never) : await this.model.create(data as never, options as SaveOptions);

    return document as unknown as HydratedDocument<T>;
  }

  /**
   * Inserts a document only when nothing matches `filter` (equality fields of the filter are copied into it).
   * Returns true when a document was created. Race-safe when a unique index covers the filter.
   */
  async createIfAbsent(filter: QueryFilter<T>, extra: Record<string, unknown> = {}): Promise<boolean> {
    try {
      const result = await this.model.updateOne(filter, { $setOnInsert: extra } as UpdateQuery<T>, { upsert: true }).exec();
      return result.upsertedCount > 0;
    } catch (error) {
      if ((error as { code?: number }).code === 11000) return false;
      throw error;
    }
  }

  /** Deletes one matching document; true when something was deleted. */
  async deleteIfPresent(filter: QueryFilter<T>): Promise<boolean> {
    const result = await this.model.deleteOne(filter).exec();
    return result.deletedCount > 0;
  }

  /** Distinct values of `field` among documents matching `filter`, as strings. */
  async distinctIds(field: string, filter: QueryFilter<T>): Promise<string[]> {
    const values = await this.model.distinct(field, filter).exec();
    return values.map((value) => String(value));
  }

  async createMany({ data, options }: { data: T[]; options?: InsertManyOptions }): Promise<HydratedDocument<T>[]> {
    const documents = await this.model.insertMany(data as Parameters<Model<T>['insertMany']>[0], options ?? {});

    return documents as unknown as HydratedDocument<T>[];
  }

  async findById(id: string | Types.ObjectId, options: ILeanRepositoryOptions<T>): Promise<T | null>;

  async findById(id: string | Types.ObjectId, options?: IHydratedRepositoryOptions<T>): Promise<HydratedDocument<T> | null>;

  async findById(id: string | Types.ObjectId, options?: IRepositoryOptions<T>): Promise<HydratedDocument<T> | T | null> {
    let query = this.model.findById(id);

    query = this.applyFindOptions(query, options);

    if (options?.lean) {
      const result = await query.lean().exec();

      return result as T | null;
    }

    const result = await query.exec();

    return result;
  }

  async findOne(
    params: IRepositoryFindOptions<T> & {
      options: ILeanRepositoryOptions<T>;
    },
  ): Promise<T | null>;

  async findOne(
    params: IRepositoryFindOptions<T> & {
      options?: IHydratedRepositoryOptions<T>;
    },
  ): Promise<HydratedDocument<T> | null>;

  async findOne({ filter = {}, options }: IRepositoryFindOptions<T>): Promise<HydratedDocument<T> | T | null> {
    let query = this.model.findOne(filter);

    query = this.applyFindOptions(query, options);

    if (options?.lean) {
      const result = await query.lean().exec();

      return result as T | null;
    }

    return query.exec();
  }

  async find(
    params: IRepositoryFindOptions<T> & {
      options: ILeanRepositoryOptions<T>;
    },
  ): Promise<T[]>;

  async find(
    params: IRepositoryFindOptions<T> & {
      options?: IHydratedRepositoryOptions<T>;
    },
  ): Promise<HydratedDocument<T>[]>;

  async find(
    params: IRepositoryFindOptions<T> & {
      options?: IRepositoryOptions<T>;
    },
  ): Promise<HydratedDocument<T>[] | T[]>;

  async find({ filter = {}, options }: IRepositoryFindOptions<T>): Promise<HydratedDocument<T>[] | T[]> {
    let query = this.model.find(filter);

    query = this.applyFindOptions(query, options);

    if (options?.lean) {
      const result = await query.lean().exec();

      return result as T[];
    }

    return query.exec();
  }

  async paginate({ filter = {}, options, page = 1, size = 5 }: IRepositoryPaginateOptions<T>): Promise<IRepositoryPaginateResult<HydratedDocument<T> | T>> {
    const currentPage = Math.max(1, page);
    const pageSize = Math.max(1, size);

    const skip = (currentPage - 1) * pageSize;

    const [data, totalDocuments] = await Promise.all([
      this.find({
        filter,
        options: {
          ...options,
          skip,
          limit: pageSize,
          lean: options?.lean === true,
        },
      }) as Promise<Array<HydratedDocument<T> | T>>,

      this.model.countDocuments(filter).exec(),
    ]);

    return {
      data,
      totalDocuments,
      totalPages: Math.ceil(totalDocuments / pageSize),
      currentPage,
      pageSize,
    };
  }

  /**
   * Lean pagination with a typed result: `P` declares what `options.populate` turns each
   * reference into, e.g. `paginateLean<{ author: AuthorCard }>(…)`.
   */
  async paginateLean<P extends object = object>(params: IRepositoryPaginateOptions<T>): Promise<IRepositoryPaginateResult<Populated<T, P>>> {
    const result = await this.paginate({ ...params, options: { ...params.options, lean: true } });
    return result as IRepositoryPaginateResult<Populated<T, P>>;
  }

  async updateOne({ filter, data, options }: IRepositoryUpdateOptions<T>): Promise<UpdateResult> {
    const update = this.addVersionIncrement(data);

    return this.model.updateOne(filter, update, options).exec();
  }

  async updateMany({ filter, data, options }: IRepositoryUpdateOptions<T>): Promise<UpdateResult> {
    const update = this.addVersionIncrement(data);

    return this.model.updateMany(filter, update, options).exec();
  }

  async findOneAndUpdate({ filter, data, options }: IRepositoryFindAndUpdateOptions<T>): Promise<HydratedDocument<T> | null> {
    const update = this.addVersionIncrement(data);

    return this.model
      .findOneAndUpdate(filter, update, {
        returnDocument: 'after',
        runValidators: true,
        ...options,
      })
      .exec();
  }

  async findByIdAndUpdate(
    id: string | Types.ObjectId,
    data: UpdateQuery<T> | UpdateWithAggregationPipeline,
    options?: IRepositoryFindAndUpdateOptions<T>['options'],
  ): Promise<HydratedDocument<T> | null> {
    const update = this.addVersionIncrement(data);

    return this.model
      .findByIdAndUpdate(id, update, {
        returnDocument: 'after',
        runValidators: true,
        ...options,
      })
      .exec();
  }

  async deleteOne(filter: QueryFilter<T>): Promise<{
    acknowledged: boolean;
    deletedCount: number;
  }> {
    return this.model.deleteOne(filter).exec();
  }

  async deleteMany(filter: QueryFilter<T>): Promise<{
    acknowledged: boolean;
    deletedCount: number;
  }> {
    return this.model.deleteMany(filter).exec();
  }

  async findOneAndDelete(filter: QueryFilter<T>, options?: IRepositoryOptions<T>): Promise<HydratedDocument<T> | null> {
    let query = this.model.findOneAndDelete(filter);

    query = this.applyFindOptions(query, options);

    return query.exec();
  }

  async findByIdAndDelete(id: string | Types.ObjectId, options?: IRepositoryOptions<T>): Promise<HydratedDocument<T> | null> {
    let query = this.model.findByIdAndDelete(id);

    query = this.applyFindOptions(query, options);

    return query.exec();
  }
}
