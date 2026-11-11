import { LikeModel } from '../model/like.model.js';
import type { ILike } from '../../dependency/interface/database.interface.js';
import { DatabaseRepository } from './base.repository.js';

export class LikeRepository extends DatabaseRepository<ILike> {
  constructor() {
    super(LikeModel);
  }
}

export const likeRepository = new LikeRepository();
