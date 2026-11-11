import type { Types } from 'mongoose';
import type { IUser } from '../interface/database.interface.js';

/** User fields that are safe to show to other users (populate/select). Never includes email, phone, DOB. */
export const PUBLIC_USER_FIELDS = 'firstName lastName username image bio privacyController followersCount followingCount postsCount';

/** Minimal author card used on posts, comments, messages and notifications. */
export const AUTHOR_FIELDS = 'firstName lastName username image';

/** Shape of a user populated with `AUTHOR_FIELDS`. */
export type AuthorCard = Pick<IUser, 'firstName' | 'lastName' | 'username' | 'image'> & { _id: Types.ObjectId };

/** Shape of a user selected with `PUBLIC_USER_FIELDS`. */
export type PublicUser = AuthorCard & Pick<IUser, 'bio' | 'privacyController' | 'followersCount' | 'followingCount' | 'postsCount'>;
