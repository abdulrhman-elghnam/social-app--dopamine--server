import { z } from 'zod';
import { UserDTO } from './dto/user.dto.js';
import { IHandlerResult, utilService } from '../../dep/service/util.service.js';
import { UserPrivacyControllerEnum } from '../../dep/value/database.enum.js';
import type { JwtPayload } from 'jsonwebtoken';
import { userRepository } from '../../db/repo/user.repository.js';
import { NotFoundException } from '../../dep/exception/main.exception.js';

class UserService {
  constructor() {}

  async changePrivacy(
    { action }: z.infer<ReturnType<UserDTO['privacyChangeDTO']>['body']>,
    payload: JwtPayload
  ): Promise<IHandlerResult> {
    console.log(payload);

    const user = await userRepository.findById(utilService.toObjectId(payload.sub as string));

    if (!user) {
      throw new NotFoundException('User not found', { messageCode: 404 });
    }

    switch (action) {
      case UserPrivacyControllerEnum.public:
        user.privacyController = UserPrivacyControllerEnum.public;
        user.save();
        break;
      case UserPrivacyControllerEnum.private:
        user.privacyController = UserPrivacyControllerEnum.private;
        user.save();
        break;
      default:
    }
    return {
      messageCode: 200,
      message: 'Privacy setting updated successfully',
      data: {
        privacyController: user.privacyController,
      },
    };
  }

  async changeAvatar(file: Express.Multer.File, payload: JwtPayload): Promise<IHandlerResult> {
    const user = await userRepository.findById(utilService.toObjectId(payload.sub as string));

    if (!user) {
      throw new NotFoundException('User not found', { messageCode: 404 });
    }

    user.image = file.path;
    await user.save();

    return {
      messageCode: 200,
      message: 'Avatar updated successfully',
      data: {
        image: user.image,
      },
    };
  }

  async search(search: string, page = 1, size = 10): Promise<IHandlerResult> {
    const result = await userRepository.searchUsers({
      search,
      page,
      size,
    });

    return {
      messageCode: 200,
      data: result.data,
      meta: {
        totalDocuments: result.totalDocuments,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
        pageSize: result.pageSize,
      },
    };
  }
}
export const userService = new UserService();
