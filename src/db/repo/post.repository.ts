import { PostModel } from '../model/post.model.js';
import type { IPost } from '../../dep/interface/database.interface.js';
import { DatabaseRepository } from './base.repository.js';

export class PostRepository extends DatabaseRepository<IPost> {
  constructor() {
    super(PostModel);
  }
}

export const postRepository = new PostRepository();
