import { DatabaseRepository } from './base.repository.js';
import { UserModel } from '../model/user.model.js';
import type { IUser } from '../../dep/interface/database.interface.js';

export class UserRepository extends DatabaseRepository<IUser> {
  constructor() {
    super(UserModel);
  }
}
export const userRepository = new UserRepository();
