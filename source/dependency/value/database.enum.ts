export enum GenderEnum {
  MALE = 'male',
  FEMALE = 'female',
}

export enum SystemRoleEnum {
  USER = 'user',
  ADMIN = 'admin',
}

export enum ProviderEnum {
  LOCAL = 'local',
  GOOGLE = 'google',
}

export enum PostVisibilityEnum {
  PUBLIC = 'public',
  FOLLOWERS = 'followers',
  PRIVATE = 'private',
}

export enum NotificationTypeEnum {
  FOLLOW = 'follow',
  FOLLOW_REQUEST = 'follow_request',
  FOLLOW_ACCEPTED = 'follow_accepted',
  LIKE = 'like',
  COMMENT = 'comment',
  REPLY = 'reply',
  COMMENT_LIKE = 'comment_like',
  SHARE = 'share',
}

export enum MediaTypeEnum {
  IMAGE = 'image',
  TEXT = 'text',
}

export enum UserPrivacyControllerEnum {
  private = 'private',
  public = 'public',
}

export enum FollowRequestStatusEnum {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

export enum MessageTypeEnum {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  FILE = 'file',
}

export enum ConversationMemberRoleEnum {
  MEMBER = 'member',
  ADMIN = 'admin',
  OWNER = 'owner',
}

export enum ReportTargetTypeEnum {
  USER = 'user',
  POST = 'post',
  COMMENT = 'comment',
}

export enum ReportStatusEnum {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
}
