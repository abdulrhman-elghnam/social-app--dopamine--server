import { CommentLikeModel } from '../model/comment-like.model.js';
import type { ICommentLike } from '../../dependency/interface/database.interface.js';
import { DatabaseRepository } from './base.repository.js';

export class CommentLikeRepository extends DatabaseRepository<ICommentLike> {
  constructor() {
    super(CommentLikeModel);
  }
}

export const commentLikeRepository = new CommentLikeRepository();
