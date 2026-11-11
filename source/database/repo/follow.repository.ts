import { FollowModel } from '../model/follow.model.js';
import type { IFollow } from '../../dependency/interface/database.interface.js';
import { DatabaseRepository } from './base.repository.js';

export class FollowRepository extends DatabaseRepository<IFollow> {
  constructor() {
    super(FollowModel);
  }
}

export const followRepository = new FollowRepository();
