import type { Types } from 'mongoose';
import { FollowRequestModel } from '../model/friend-request.model.js';
import type { IFollowRequest } from '../../dependency/interface/database.interface.js';
import { FollowRequestStatusEnum } from '../../dependency/value/database.enum.js';
import { AUTHOR_FIELDS, type AuthorCard } from '../../dependency/value/projection.value.js';
import { DatabaseRepository } from './base.repository.js';

export class FollowRequestRepository extends DatabaseRepository<IFollowRequest> {
  constructor() {
    super(FollowRequestModel);
  }

  async findBetween(requester: Types.ObjectId, recipient: Types.ObjectId) {
    return this.findOne({ filter: { requester, recipient } });
  }
  
  async paginatePending(userId: Types.ObjectId, direction: 'received' | 'sent', page: number, size: number) {
    const mine = direction === 'received' ? 'recipient' : 'requester';
    const other = direction === 'received' ? 'requester' : 'recipient';
    // Only the other party is populated; your own side stays an id.
    return this.paginateLean<{ requester: AuthorCard | Types.ObjectId; recipient: AuthorCard | Types.ObjectId }>({
      filter: { [mine]: userId, status: FollowRequestStatusEnum.PENDING },
      options: { sort: { createdAt: -1 }, populate: { path: other, select: AUTHOR_FIELDS } },
      page,
      size,
    });
  }
  
  async deleteBetween(a: Types.ObjectId, b: Types.ObjectId): Promise<void> {
    await this.deleteMany({
      $or: [
        { requester: a, recipient: b },
        { requester: b, recipient: a },
      ],
    });
  }
}

export const followRequestRepository = new FollowRequestRepository();
