
import { Types } from 'mongoose';

import {
    ConversationMemberRoleEnum,
  FollowRequestStatusEnum,
  GenderEnum,
  MediaTypeEnum,
  MessageTypeEnum,
  NotificationTypeEnum,
  PostVisibilityEnum,
  ProviderEnum,
  ReportStatusEnum,
  ReportTargetTypeEnum,
  SystemRoleEnum,
  UserPrivacyControllerEnum,
} from '../value/database.enum.js';

export interface IUser {
  _id?: Types.ObjectId;

  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password?: string;

  gender: GenderEnum;
  role: SystemRoleEnum;
  provider: ProviderEnum;

  phone?: string;
  DOB?: Date;

  isEmailVerified: boolean;
  isActive: boolean;

  image?: string;
  coverImage?: string;
  bio?: string;

  privacyController: UserPrivacyControllerEnum;

  followersCount?: number;
  followingCount?: number;
  postsCount?: number;

  lastSeenAt?: Date;
  changeCredentialsTime?: Date;
  deletedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface IFollow {
  _id?: Types.ObjectId;

  follower: Types.ObjectId;
  following: Types.ObjectId;

  createdAt?: Date;
}

export interface IFollowRequest {
  _id?: Types.ObjectId;

  requester: Types.ObjectId;
  recipient: Types.ObjectId;

  status: FollowRequestStatusEnum;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface IMedia {
  url: string;
  type: MediaTypeEnum;

  publicId?: string;

  width?: number;
  height?: number;

  duration?: number;
  size?: number;

  thumbnailUrl?: string;
}

export interface IPost {
  _id?: Types.ObjectId;

  author: Types.ObjectId;

  content?: string;
  media: IMedia[];

  visibility: PostVisibilityEnum;

  likesCount: number;
  commentsCount: number;
  sharesCount: number;

  commentsEnabled: boolean;

  editedAt?: Date;
  deletedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface ILike {
  _id?: Types.ObjectId;

  user: Types.ObjectId;
  post: Types.ObjectId;

  createdAt?: Date;
}

export interface IComment {
  _id?: Types.ObjectId;

  post: Types.ObjectId;
  author: Types.ObjectId;

  parentComment?: Types.ObjectId;

  content: string;

  likesCount: number;
  repliesCount: number;

  editedAt?: Date;
  deletedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICommentLike {
  _id?: Types.ObjectId;

  user: Types.ObjectId;
  comment: Types.ObjectId;

  createdAt?: Date;
}

export interface ISavedPost {
  _id?: Types.ObjectId;

  user: Types.ObjectId;
  post: Types.ObjectId;

  createdAt?: Date;
}

export interface IShare {
  _id?: Types.ObjectId;

  user: Types.ObjectId;
  post: Types.ObjectId;

  content?: string;

  createdAt?: Date;
}

export interface INotification {
  _id?: Types.ObjectId;

  recipient: Types.ObjectId;
  sender: Types.ObjectId;

  type: NotificationTypeEnum;

  post?: Types.ObjectId;
  comment?: Types.ObjectId;

  isRead: boolean;
  readAt?: Date;

  createdAt?: Date;
}

export interface IStory {
  _id?: Types.ObjectId;

  author: Types.ObjectId;

  media: IMedia[];

  viewers: Types.ObjectId[];

  expiresAt: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface IStoryView {
  _id?: Types.ObjectId;

  story: Types.ObjectId;
  user: Types.ObjectId;

  viewedAt?: Date;
}

export interface IBlock {
  _id?: Types.ObjectId;

  blocker: Types.ObjectId;
  blocked: Types.ObjectId;

  createdAt?: Date;
}

export interface IReport {
  _id?: Types.ObjectId;

  reporter: Types.ObjectId;

  targetType: ReportTargetTypeEnum;

  reportedUser?: Types.ObjectId;
  post?: Types.ObjectId;
  comment?: Types.ObjectId;

  reason: string;
  description?: string;

  status: ReportStatusEnum;

  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface IConversation {
  _id?: Types.ObjectId;

  participants: Types.ObjectId[];

  lastMessage?: Types.ObjectId;

  isGroup: boolean;

  groupName?: string;
  groupImage?: string;

  createdBy?: Types.ObjectId;
  admins?: Types.ObjectId[];

  createdAt?: Date;
  updatedAt?: Date;
}

export interface IConversationMember {
  _id?: Types.ObjectId;

  conversation: Types.ObjectId;
  user: Types.ObjectId;

  role: ConversationMemberRoleEnum;

  joinedAt: Date;

  lastReadMessage?: Types.ObjectId;

  isMuted: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface IMessage {
  _id?: Types.ObjectId;

  conversation: Types.ObjectId;
  sender: Types.ObjectId;

  content?: string;
  media?: IMedia[];

  type: MessageTypeEnum;

  replyTo?: Types.ObjectId;

  readBy: Types.ObjectId[];
  deliveredTo: Types.ObjectId[];

  editedAt?: Date;
  deletedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}
