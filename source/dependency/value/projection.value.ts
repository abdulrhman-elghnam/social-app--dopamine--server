import type { Types } from 'mongoose';
import type { IUser } from '../interface/database.interface.js';

export const PUBLIC_USER_FIELDS = 'firstName lastName username image bio privacyController followersCount followingCount postsCount';

export const AUTHOR_FIELDS = 'firstName lastName username image';

export type AuthorCard = Pick<IUser, 'firstName' | 'lastName' | 'username' | 'image'> & { _id: Types.ObjectId };

export type PublicUser = AuthorCard & Pick<IUser, 'bio' | 'privacyController' | 'followersCount' | 'followingCount' | 'postsCount'>;
