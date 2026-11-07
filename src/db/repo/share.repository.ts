import { ShareModel } from '../model/share.model.js';
import type { IShare } from '../../dep/interface/database.interface.js';
import { DatabaseRepository } from './base.repository.js';

export class ShareRepository extends DatabaseRepository<IShare> {
  constructor() {
    super(ShareModel);
  }
}

export const shareRepository = new ShareRepository();
