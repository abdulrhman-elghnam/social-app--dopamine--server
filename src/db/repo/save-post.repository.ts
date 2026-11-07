import { SavedPostModel } from '../model/save-post.model.js';
import type { ISavedPost } from '../../dep/interface/database.interface.js';
import { DatabaseRepository } from './base.repository.js';

export class SavedPostRepository extends DatabaseRepository<ISavedPost> {
  constructor() {
    super(SavedPostModel);
  }
}

export const savedPostRepository = new SavedPostRepository();
