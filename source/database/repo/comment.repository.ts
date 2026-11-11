import { CommentModel } from '../model/comment.model.js';
import type { IComment } from '../../dependency/interface/database.interface.js';
import { DatabaseRepository } from './base.repository.js';

export class CommentRepository extends DatabaseRepository<IComment> {
  constructor() {
    super(CommentModel);
  }
}

export const commentRepository = new CommentRepository();
