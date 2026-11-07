import { FollowRequestModel } from '../model/friend-request.model.js';
import type { IFollowRequest } from '../../dep/interface/database.interface.js';
import { DatabaseRepository } from './base.repository.js';

export class FollowRequestRepository extends DatabaseRepository<IFollowRequest> {
  constructor() {
    super(FollowRequestModel);
  }
}

export const followRequestRepository = new FollowRequestRepository();
