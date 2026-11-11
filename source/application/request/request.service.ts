import type { JwtPayload } from 'jsonwebtoken';
import { FollowRequestStatusEnum } from '../../dependency/value/database.enum.js';
import { ConflictException, NotFoundException } from '../../dependency/exception/main.exception.js';
import type { IHandlerResult } from '../../dependency/service/util.service.js';
import { utilService } from '../../dependency/service/util.service.js';
import { followRepository } from '../../database/repo/follow.repository.js';
import { followRequestRepository } from '../../database/repo/friend-request.repository.js';
import { userRepository } from '../../database/repo/user.repository.js';

class RequestService {
  private async getReceivedRequest(requestId: string, userId: string) {
    const request = await followRequestRepository.findOne({
      filter: {
        _id: utilService.toObjectId(requestId),
        recipient: utilService.toObjectId(userId),
      },
    });

    if (!request) {
      throw new NotFoundException('Follow request not found', { messageCode: 404 });
    }
    return request;
  }

  acceptRequest = async (requestId: string, payload: JwtPayload): Promise<IHandlerResult> => {
    const request = await this.getReceivedRequest(requestId, payload.sub as string);

    if (request.status !== FollowRequestStatusEnum.PENDING) {
      throw new ConflictException('Follow request is no longer pending');
    }

    const existingFollow = await followRepository.findOne({
      filter: {
        follower: request.requester,
        following: request.recipient,
      },
    });
    if (!existingFollow) {
      await followRepository.create({
      data: {
        follower: request.requester,
        following: request.recipient,
      },
      });
      await userRepository.updateFollowCounts({
        followerId: request.requester,
        followingId: request.recipient,
        amount: 1,
      });
    }
    request.status = FollowRequestStatusEnum.ACCEPTED;
    await request.save();

    return { messageCode: 200, message: 'Follow request accepted' };
  };

  rejectRequest = async (requestId: string, payload: JwtPayload): Promise<IHandlerResult> => {
    const request = await this.getReceivedRequest(requestId, payload.sub as string);

    if (request.status !== FollowRequestStatusEnum.PENDING) {
      throw new ConflictException('Follow request is no longer pending');
    }

    request.status = FollowRequestStatusEnum.REJECTED;
    await request.save();

    return { messageCode: 200, message: 'Follow request rejected' };
  };

  deleteRequest = async (requestId: string, payload: JwtPayload): Promise<IHandlerResult> => {
    const request = await followRequestRepository.findOne({
      filter: {
        _id: utilService.toObjectId(requestId),
        $or: [
          { requester: utilService.toObjectId(payload.sub as string) },
          { recipient: utilService.toObjectId(payload.sub as string) },
        ],
      },
    });

    if (!request) {
      throw new NotFoundException('Follow request not found', { messageCode: 404 });
    }

    if (request.status === FollowRequestStatusEnum.ACCEPTED) {
      const follow = await followRepository.findOne({
        filter: {
          follower: request.requester,
          following: request.recipient,
        },
      });
      if (follow) {
        await followRepository.deleteOne({
          follower: follow.follower,
          following: follow.following,
        });
        await userRepository.updateFollowCounts({
          followerId: request.requester,
          followingId: request.recipient,
          amount: -1,
        });
      }
    }

    await followRequestRepository.deleteOne({ _id: request._id });
    return { messageCode: 200, message: 'Follow request deleted' };
  };

  getRequests = async (payload: JwtPayload): Promise<IHandlerResult> => {
    const requests = await followRequestRepository.find({
      filter: {
        recipient: utilService.toObjectId(payload.sub as string),
        status: FollowRequestStatusEnum.PENDING,
      },
      options: {
        populate: 'requester',
        sort: { createdAt: -1 },
        lean: true,
      },
    });

    return { messageCode: 200, data: requests };
  };
}

export const requestService = new RequestService();
