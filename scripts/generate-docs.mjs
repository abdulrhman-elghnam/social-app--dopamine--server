/**
 * Generates the Dopamine API documentation from the code:
 *   public/documentation/swagger.json  — OpenAPI 3.1 (served as Swagger UI at /docs)
 *   public/documentation/postman.json  — Postman collection v2.1 (served at /docs/postman.json)
 *
 * Request schemas come straight from the zod DTOs (`z.toJSONSchema`), so they can't drift from
 * validation. Every example body is parsed with its DTO before writing; a bad example fails the run.
 *
 * Usage: npm run docs   (builds first — this script imports the compiled DTOs from distribution/)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z } from 'zod';

const PRODUCTION_URL = (process.env['DOCS_PRODUCTION_URL'] || 'https://dopamine-sable-xi.vercel.app').replace(/\/$/, '');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const outDir = resolve(root, 'public/documentation');

const load = (path) => import(pathToFileURL(resolve(root, 'distribution', path)).href);
const auth = await load('application/authentication/dto/authentication.dto.js');
const user = await load('application/user/dto/user.dto.js');
const follow = await load('application/follow-request/dto/follow-request.dto.js');
const post = await load('application/post/dto/post.dto.js');
const comment = await load('application/comment/dto/comment.dto.js');
const notification = await load('application/notification/dto/notification.dto.js');
const chat = await load('application/chat/dto/conversation.dto.js');
const report = await load('application/report/dto/report.dto.js');

// ── metadata ─────────────────────────────────────────────────────────────────────────────────────

const APP = {
  name: 'Dopamine',
  summary: 'Dopamine is a social app for connecting people.',
  description: [
    'Dopamine is a social app for connecting people: share posts, follow friends (private accounts approve followers),',
    'comment and react, get notified, and chat one-to-one or in groups in real time.',
  ].join(' '),
};

const SAMPLE_ID = '665f1c2ab3e4d5f6a7b8c9d0';

const TAGS = [
  { name: 'Auth', description: 'Register, verify email, sign in (password or Google), refresh and revoke sessions, reset passwords.' },
  { name: 'Users', description: 'Your profile, other profiles, search and suggestions, followers/following, blocking.' },
  { name: 'Follow requests', description: 'Following public accounts is instant; private accounts receive a request to accept or reject.' },
  { name: 'Posts', description: 'Home feed, create/edit/delete posts, likes, saves and shares.' },
  { name: 'Comments', description: 'Comments and one-level replies on posts, with likes.' },
  { name: 'Notifications', description: 'Activity about you (follows, likes, comments, shares). Also pushed live as `notification:new`.' },
  { name: 'Conversations', description: 'Direct and group chats over REST. Sending, editing and deleting messages happens over Socket.IO.' },
  { name: 'Reports', description: 'Report users, posts or comments. Listing and reviewing are admin-only.' },
  { name: 'System', description: 'Health and service info.' },
];

// ── response models (mirrors client/src/api/types.ts) ────────────────────────────────────────────

const id = { type: 'string', pattern: '^[a-f\\d]{24}$', example: SAMPLE_ID };
const date = { type: 'string', format: 'date-time' };
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const refOrId = (name) => ({ oneOf: [id, ref(name)], description: `Populated ${name}, or its id on create/update responses.` });

const models = {
  PageMeta: {
    type: 'object',
    properties: { totalDocuments: { type: 'integer' }, totalPages: { type: 'integer' }, currentPage: { type: 'integer' }, pageSize: { type: 'integer' } },
  },
  Tokens: {
    type: 'object',
    required: ['access_token', 'refresh_token'],
    properties: {
      access_token: { type: 'string', description: 'JWT, send as `Authorization: Bearer <token>`.' },
      refresh_token: { type: 'string', description: 'JWT for `POST /auth/refresh` (single use; rotates both tokens).' },
    },
  },
  Author: {
    type: 'object',
    properties: {
      _id: id,
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      username: { type: 'string' },
      image: { type: 'string', description: 'Server-relative path, e.g. `assets/avatars/x.jpg`.' },
    },
  },
  PublicUser: {
    allOf: [
      ref('Author'),
      {
        type: 'object',
        properties: {
          bio: { type: 'string' },
          privacyController: { type: 'string', enum: ['public', 'private'] },
          followersCount: { type: 'integer' },
          followingCount: { type: 'integer' },
          postsCount: { type: 'integer' },
        },
      },
    ],
  },
  UserProfile: {
    allOf: [
      ref('PublicUser'),
      {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          coverImage: { type: 'string' },
          phone: { type: 'string' },
          DOB: date,
          gender: { type: 'string' },
          isEmailVerified: { type: 'boolean' },
          lastSeenAt: date,
          createdAt: date,
        },
      },
    ],
  },
  Relationship: {
    type: 'object',
    properties: {
      isSelf: { type: 'boolean' },
      isFollowing: { type: 'boolean' },
      followsYou: { type: 'boolean' },
      followRequest: { oneOf: [{ type: 'null' }, { type: 'object', properties: { _id: id, status: { const: 'pending' } } }] },
      isOnline: { type: 'boolean' },
    },
  },
  ProfileView: {
    allOf: [
      ref('PublicUser'),
      {
        type: 'object',
        properties: {
          isRestricted: { type: 'boolean', description: 'Private account you do not follow: only the limited card is returned.' },
          relationship: ref('Relationship'),
        },
      },
    ],
  },
  Post: {
    type: 'object',
    properties: {
      _id: id,
      author: refOrId('Author'),
      content: { type: 'string' },
      visibility: { type: 'string', enum: ['public', 'followers', 'private'] },
      likesCount: { type: 'integer' },
      commentsCount: { type: 'integer' },
      sharesCount: { type: 'integer' },
      commentsEnabled: { type: 'boolean' },
      isLiked: { type: 'boolean', description: 'Viewer flag on list/detail responses.' },
      isSaved: { type: 'boolean', description: 'Viewer flag on list/detail responses.' },
      editedAt: date,
      createdAt: date,
      updatedAt: date,
    },
  },
  Comment: {
    type: 'object',
    properties: {
      _id: id,
      post: id,
      author: refOrId('Author'),
      parentComment: { ...id, description: 'Set on replies (one level deep).' },
      content: { type: 'string' },
      likesCount: { type: 'integer' },
      repliesCount: { type: 'integer' },
      isLiked: { type: 'boolean' },
      editedAt: date,
      createdAt: date,
      updatedAt: date,
    },
  },
  LikeState: { type: 'object', properties: { isLiked: { type: 'boolean' }, likesCount: { type: 'integer' } } },
  FollowRequest: {
    type: 'object',
    properties: {
      _id: id,
      requester: refOrId('Author'),
      recipient: refOrId('Author'),
      status: { type: 'string', enum: ['pending', 'accepted', 'rejected'] },
      createdAt: date,
      updatedAt: date,
    },
  },
  Notification: {
    type: 'object',
    properties: {
      _id: id,
      recipient: id,
      sender: refOrId('Author'),
      type: { type: 'string', enum: ['follow', 'follow_request', 'follow_accepted', 'like', 'comment', 'reply', 'comment_like', 'share'] },
      post: id,
      comment: id,
      isRead: { type: 'boolean' },
      readAt: date,
      createdAt: date,
    },
  },
  MessagePreview: {
    type: 'object',
    properties: { _id: id, sender: id, content: { type: 'string' }, type: { type: 'string' }, createdAt: date, deletedAt: date },
  },
  Message: {
    type: 'object',
    properties: {
      _id: id,
      conversation: id,
      sender: refOrId('Author'),
      content: { type: 'string', description: 'Removed when the message is deleted.' },
      media: { type: 'array', items: { type: 'object', properties: { url: { type: 'string' }, type: { type: 'string' } } } },
      type: { type: 'string', enum: ['text', 'image', 'video', 'audio', 'file'] },
      replyTo: { oneOf: [{ type: 'null' }, id, ref('MessagePreview')] },
      readBy: { type: 'array', items: id },
      deliveredTo: { type: 'array', items: id },
      editedAt: date,
      deletedAt: date,
      createdAt: date,
      updatedAt: date,
    },
  },
  Conversation: {
    type: 'object',
    properties: {
      _id: id,
      participants: { type: 'array', items: ref('Author') },
      lastMessage: { oneOf: [{ type: 'null' }, ref('MessagePreview')] },
      isGroup: { type: 'boolean' },
      groupName: { type: 'string' },
      groupImage: { type: 'string' },
      createdBy: id,
      admins: { type: 'array', items: id },
      isMuted: { type: 'boolean' },
      role: { type: 'string', enum: ['member', 'admin', 'owner'] },
      onlineParticipants: { type: 'array', items: id },
      unreadCount: { type: 'integer', description: 'List only.' },
      lastReadMessage: { oneOf: [{ type: 'null' }, id], description: 'Detail only.' },
      createdAt: date,
      updatedAt: date,
    },
  },
  ReadReceipt: { type: 'object', properties: { conversationId: id, userId: id, messageId: { oneOf: [{ type: 'null' }, id] }, readAt: date } },
  Report: {
    type: 'object',
    properties: {
      _id: id,
      reporter: refOrId('Author'),
      targetType: { type: 'string', enum: ['user', 'post', 'comment'] },
      reportedUser: refOrId('Author'),
      post: id,
      comment: id,
      reason: { type: 'string' },
      description: { type: 'string' },
      status: { type: 'string', enum: ['pending', 'reviewed', 'resolved', 'rejected'] },
      reviewedBy: refOrId('Author'),
      reviewedAt: date,
      createdAt: date,
      updatedAt: date,
    },
  },
  Error: {
    type: 'object',
    required: ['errorMessage'],
    properties: {
      errorMessage: { type: 'string', description: 'Localized (English / Arabic via `Accept-Language`).' },
      error: { type: 'string', description: 'Developer message (omitted on 5xx in production).' },
    },
  },
};

const one = (name) => ref(name);
const many = (name) => ({ type: 'array', items: ref(name) });
const obj = (properties) => ({ type: 'object', properties });

// ── routes ───────────────────────────────────────────────────────────────────────────────────────
// auth: 'none' | 'user' | 'admin'. `body` is the example request body ({{vars}} are Postman variables).
// `save` = Postman test lines that store response values for the following requests.

const routes = [
  // System
  {
    tag: 'System',
    method: 'get',
    path: '/health',
    auth: 'none',
    summary: 'Liveness check (does not touch the database)',
    data: obj({ status: { const: 'ok' }, uptime: { type: 'integer' } }),
    raw: true,
  },
  { tag: 'System', method: 'get', path: '/', auth: 'none', summary: 'Welcome message' },

  // Auth
  {
    tag: 'Auth',
    method: 'post',
    path: '/auth/register',
    auth: 'none',
    dto: auth.SignupDTO,
    status: 201,
    summary: 'Create an account',
    description: 'Emails a 6-digit code; verify it with `POST /auth/verify-otp` before signing in. Rate limited (10 failed / 15 min).',
    body: {
      fullName: 'Mona Ahmed',
      username: 'mona_ahmed',
      email: 'mona@example.com',
      phoneNumber: '01012345678',
      DOB: '1998-04-12',
      gender: 'FEMALE',
      password: 'Dopamine@2026',
      confirmPassword: 'Dopamine@2026',
    },
  },
  {
    tag: 'Auth',
    method: 'post',
    path: '/auth/verify-otp',
    auth: 'none',
    dto: auth.OtpDTO,
    summary: 'Verify email with the emailed code',
    description: 'Rate limited (10 / 15 min, shared with the other code endpoints).',
    body: { email: 'mona@example.com', otp: '123456' },
  },
  {
    tag: 'Auth',
    method: 'post',
    path: '/auth/login',
    auth: 'none',
    dto: auth.LoginDTO,
    data: one('Tokens'),
    summary: 'Sign in with email and password',
    description: 'Returns an access + refresh token pair. Rate limited (10 failed / 15 min).',
    body: { email: 'mona@example.com', password: 'Dopamine@2026' },
    save: ['accessToken=data.access_token', 'refreshToken=data.refresh_token'],
  },
  {
    tag: 'Auth',
    method: 'post',
    path: '/auth/google',
    auth: 'none',
    dto: auth.GoogleSignUpDTO,
    status: 201,
    data: one('Tokens'),
    summary: 'Sign in or sign up with a Google ID token',
    body: { idToken: '<google-id-token>' },
    save: ['accessToken=data.access_token', 'refreshToken=data.refresh_token'],
  },
  {
    tag: 'Auth',
    method: 'post',
    path: '/auth/refresh',
    auth: 'user',
    dto: auth.RefreshTokenDTO,
    data: one('Tokens'),
    summary: 'Rotate tokens',
    description: 'Single use: the refresh token is revoked and a new pair is returned. Rate limited (30 / 15 min).',
    body: { refreshToken: '{{refreshToken}}' },
    save: ['accessToken=data.access_token', 'refreshToken=data.refresh_token'],
  },
  {
    tag: 'Auth',
    method: 'post',
    path: '/auth/logout',
    auth: 'user',
    dto: auth.LogoutDTO,
    summary: 'Sign out',
    description: '`type: "SINGLE"` (default) revokes this session (+ the given refresh token); `"ALL"` revokes every session.',
    body: { type: 'SINGLE', refreshToken: '{{refreshToken}}' },
  },
  {
    tag: 'Auth',
    method: 'post',
    path: '/auth/forgot-password',
    auth: 'none',
    dto: auth.EmailDTO,
    status: 201,
    summary: 'Email a password-reset code',
    body: { email: 'mona@example.com' },
  },
  {
    tag: 'Auth',
    method: 'post',
    path: '/auth/verify-forgot-password',
    auth: 'none',
    dto: auth.OtpDTO,
    summary: 'Check a password-reset code',
    body: { email: 'mona@example.com', otp: '123456' },
  },
  {
    tag: 'Auth',
    method: 'post',
    path: '/auth/change-password',
    auth: 'none',
    dto: auth.ChangePasswordDTO,
    summary: 'Set a new password with the reset code',
    description: 'Signs out every session.',
    body: { email: 'mona@example.com', otp: '123456', password: 'Dopamine@2027', confirmPassword: 'Dopamine@2027' },
  },

  // Users
  { tag: 'Users', method: 'get', path: '/users/me', auth: 'user', summary: 'Your full profile', data: one('UserProfile'), save: ['userId=data._id'] },
  {
    tag: 'Users',
    method: 'patch',
    path: '/users/me',
    auth: 'user',
    dto: user.UpdateMeDTO,
    summary: 'Update your profile',
    description: 'Send at least one field.',
    data: one('UserProfile'),
    body: { bio: 'Coffee, code and good company.', privacyController: 'public' },
  },
  {
    tag: 'Users',
    method: 'patch',
    path: '/users/me/avatar',
    auth: 'user',
    upload: 'avatar',
    summary: 'Upload your avatar',
    description: 'Multipart field `avatar`: JPEG/PNG, max 5 MB. Rate limited (10 / hour).',
    data: obj({ image: { type: 'string' } }),
  },
  {
    tag: 'Users',
    method: 'patch',
    path: '/users/me/cover-image',
    auth: 'user',
    upload: 'coverImage',
    summary: 'Upload your cover image',
    description: 'Multipart field `coverImage`: JPEG/PNG, max 5 MB. Rate limited (10 / hour).',
    data: obj({ coverImage: { type: 'string' } }),
  },
  {
    tag: 'Users',
    method: 'get',
    path: '/users/search',
    auth: 'user',
    dto: user.SearchUsersDTO,
    query: { q: 'mona', page: '1', size: '10' },
    summary: 'Search users by name or username',
    data: many('PublicUser'),
    paged: true,
  },
  {
    tag: 'Users',
    method: 'get',
    path: '/users/me/blocked',
    auth: 'user',
    dto: user.BlockedUsersDTO,
    query: { page: '1', size: '20' },
    summary: 'Users you have blocked',
    description: 'Newest first. Unblock with `DELETE /users/{userId}/block`.',
    data: many('PublicUser'),
    paged: true,
  },
  {
    tag: 'Users',
    method: 'get',
    path: '/users/suggestions',
    auth: 'user',
    dto: user.SuggestUsersDTO,
    query: { page: '1', size: '10' },
    summary: 'People you may know',
    data: many('PublicUser'),
    paged: true,
  },
  {
    tag: 'Users',
    method: 'get',
    path: '/users/{userId}',
    auth: 'user',
    dto: user.UserIdDTO,
    summary: 'A user profile with your relationship to it',
    description: 'Private accounts you do not follow return a limited card (`isRestricted: true`). Blocked users look like 404.',
    data: one('ProfileView'),
  },
  {
    tag: 'Users',
    method: 'get',
    path: '/users/{userId}/followers',
    auth: 'user',
    dto: user.UserListDTO,
    query: { page: '1', size: '10' },
    summary: 'Followers',
    description: '403 for private accounts you do not follow.',
    data: many('PublicUser'),
    paged: true,
  },
  {
    tag: 'Users',
    method: 'get',
    path: '/users/{userId}/following',
    auth: 'user',
    dto: user.UserListDTO,
    query: { page: '1', size: '10' },
    summary: 'Following',
    description: '403 for private accounts you do not follow.',
    data: many('PublicUser'),
    paged: true,
  },
  {
    tag: 'Users',
    method: 'get',
    path: '/users/{userId}/posts',
    auth: 'user',
    dto: user.UserListDTO,
    query: { page: '1', size: '10' },
    summary: "A user's posts",
    description: 'Filtered by visibility; 403 for private accounts you do not follow.',
    data: many('Post'),
    paged: true,
  },
  {
    tag: 'Users',
    method: 'post',
    path: '/users/{userId}/block',
    auth: 'user',
    dto: user.UserIdDTO,
    summary: 'Block a user',
    description: 'Hides both users from each other everywhere and removes follows both ways.',
    data: obj({ userId: id, isBlocked: { const: true } }),
  },
  {
    tag: 'Users',
    method: 'delete',
    path: '/users/{userId}/block',
    auth: 'user',
    dto: user.UserIdDTO,
    summary: 'Unblock a user',
    data: obj({ userId: id, isBlocked: { const: false } }),
  },
  {
    tag: 'Users',
    method: 'delete',
    path: '/users/{userId}/follow',
    auth: 'user',
    dto: user.UserIdDTO,
    summary: 'Unfollow a user',
    data: obj({ userId: id, isFollowing: { const: false } }),
  },

  // Follow requests
  {
    tag: 'Follow requests',
    method: 'get',
    path: '/follow-requests/received',
    auth: 'user',
    dto: follow.ListFollowRequestsDTO,
    query: { page: '1', size: '10' },
    summary: 'Pending requests to you',
    data: many('FollowRequest'),
    paged: true,
    save: ['requestId=data[0]._id'],
  },
  {
    tag: 'Follow requests',
    method: 'get',
    path: '/follow-requests/sent',
    auth: 'user',
    dto: follow.ListFollowRequestsDTO,
    query: { page: '1', size: '10' },
    summary: 'Your pending requests',
    data: many('FollowRequest'),
    paged: true,
  },
  {
    tag: 'Follow requests',
    method: 'post',
    path: '/follow-requests/{userId}',
    auth: 'user',
    dto: follow.SendFollowRequestDTO,
    status: 201,
    summary: 'Follow a user',
    description: 'Public accounts are followed at once (`status: "following"`); private ones get a request (`status: "requested"`).',
    data: { oneOf: [obj({ status: { const: 'following' } }), obj({ status: { const: 'requested' }, request: ref('FollowRequest') })] },
  },
  {
    tag: 'Follow requests',
    method: 'patch',
    path: '/follow-requests/{requestId}/accept',
    auth: 'user',
    dto: follow.FollowRequestIdDTO,
    summary: 'Accept a request',
    data: one('FollowRequest'),
  },
  {
    tag: 'Follow requests',
    method: 'patch',
    path: '/follow-requests/{requestId}/reject',
    auth: 'user',
    dto: follow.FollowRequestIdDTO,
    summary: 'Reject a request',
    data: one('FollowRequest'),
  },
  {
    tag: 'Follow requests',
    method: 'delete',
    path: '/follow-requests/{requestId}',
    auth: 'user',
    dto: follow.FollowRequestIdDTO,
    summary: 'Cancel your request',
  },

  // Posts
  {
    tag: 'Posts',
    method: 'get',
    path: '/posts',
    auth: 'user',
    dto: post.GetPostsDTO,
    query: { page: '1', size: '10' },
    summary: 'Home feed',
    description: 'Your posts plus those of people you follow, newest first.',
    data: many('Post'),
    paged: true,
  },
  {
    tag: 'Posts',
    method: 'post',
    path: '/posts',
    auth: 'user',
    dto: post.CreatePostDTO,
    status: 201,
    summary: 'Create a post',
    description: 'Rate limited (60 writes / 15 min).',
    data: one('Post'),
    body: { content: 'Hello Dopamine 👋', visibility: 'public', commentsEnabled: true },
    save: ['postId=data._id'],
  },
  { tag: 'Posts', method: 'get', path: '/posts/{postId}', auth: 'user', dto: post.PostIdDTO, summary: 'A post', data: one('Post') },
  {
    tag: 'Posts',
    method: 'patch',
    path: '/posts/{postId}',
    auth: 'user',
    dto: post.UpdatePostDTO,
    summary: 'Edit your post',
    data: one('Post'),
    body: { content: 'Hello Dopamine 👋 (edited)', visibility: 'followers' },
  },
  {
    tag: 'Posts',
    method: 'delete',
    path: '/posts/{postId}',
    auth: 'user',
    dto: post.PostIdDTO,
    summary: 'Delete your post',
    description: 'Soft delete; its comments go with it.',
  },
  {
    tag: 'Posts',
    method: 'post',
    path: '/posts/{postId}/like',
    auth: 'user',
    dto: post.PostIdDTO,
    summary: 'Like a post',
    data: { allOf: [one('LikeState'), obj({ postId: id })] },
  },
  {
    tag: 'Posts',
    method: 'delete',
    path: '/posts/{postId}/like',
    auth: 'user',
    dto: post.PostIdDTO,
    summary: 'Unlike a post',
    data: { allOf: [one('LikeState'), obj({ postId: id })] },
  },
  {
    tag: 'Posts',
    method: 'post',
    path: '/posts/{postId}/save',
    auth: 'user',
    dto: post.PostIdDTO,
    summary: 'Save a post',
    data: obj({ postId: id, isSaved: { const: true } }),
  },
  {
    tag: 'Posts',
    method: 'delete',
    path: '/posts/{postId}/save',
    auth: 'user',
    dto: post.PostIdDTO,
    summary: 'Remove from saved',
    data: obj({ postId: id, isSaved: { const: false } }),
  },
  {
    tag: 'Posts',
    method: 'post',
    path: '/posts/{postId}/share',
    auth: 'user',
    dto: post.SharePostDTO,
    status: 201,
    summary: 'Share a post',
    description: 'Public posts (or your own) only. Rate limited (60 writes / 15 min).',
    body: { content: 'Worth a read' },
    data: obj({ share: obj({ _id: id, user: id, post: id, content: { type: 'string' }, createdAt: date }), sharesCount: { type: 'integer' } }),
  },

  // Comments
  {
    tag: 'Comments',
    method: 'get',
    path: '/posts/{postId}/comments',
    auth: 'user',
    dto: comment.GetCommentsDTO,
    query: { page: '1', size: '10' },
    summary: 'Top-level comments of a post',
    data: many('Comment'),
    paged: true,
  },
  {
    tag: 'Comments',
    method: 'post',
    path: '/posts/{postId}/comments',
    auth: 'user',
    dto: comment.CreateCommentDTO,
    status: 201,
    summary: 'Comment (or reply with `parentCommentId`)',
    description: 'Rate limited (60 writes / 15 min).',
    data: one('Comment'),
    body: { content: 'Love this!' },
    save: ['commentId=data._id'],
  },
  {
    tag: 'Comments',
    method: 'patch',
    path: '/comments/{commentId}',
    auth: 'user',
    dto: comment.UpdateCommentDTO,
    summary: 'Edit your comment',
    data: one('Comment'),
    body: { content: 'Love this! (edited)' },
  },
  {
    tag: 'Comments',
    method: 'delete',
    path: '/comments/{commentId}',
    auth: 'user',
    dto: comment.CommentIdDTO,
    summary: 'Delete a comment',
    description: 'Comment author or the post owner. Removes its replies.',
    data: obj({ commentId: id, removedReplies: { type: 'integer' } }),
  },
  {
    tag: 'Comments',
    method: 'post',
    path: '/comments/{commentId}/like',
    auth: 'user',
    dto: comment.CommentIdDTO,
    summary: 'Like a comment',
    data: { allOf: [one('LikeState'), obj({ commentId: id })] },
  },
  {
    tag: 'Comments',
    method: 'delete',
    path: '/comments/{commentId}/like',
    auth: 'user',
    dto: comment.CommentIdDTO,
    summary: 'Unlike a comment',
    data: { allOf: [one('LikeState'), obj({ commentId: id })] },
  },
  {
    tag: 'Comments',
    method: 'get',
    path: '/comments/{commentId}/replies',
    auth: 'user',
    dto: comment.GetRepliesDTO,
    query: { page: '1', size: '10' },
    summary: 'Replies to a comment',
    data: many('Comment'),
    paged: true,
  },

  // Notifications
  {
    tag: 'Notifications',
    method: 'get',
    path: '/notifications',
    auth: 'user',
    dto: notification.GetNotificationsDTO,
    query: { page: '1', size: '20' },
    summary: 'Your notifications',
    description: '`meta.unreadCount` carries the unread total. Add `unread=true` for unread only.',
    data: many('Notification'),
    paged: true,
    meta: { allOf: [ref('PageMeta'), obj({ unreadCount: { type: 'integer' } })] },
    save: ['notificationId=data[0]._id'],
  },
  {
    tag: 'Notifications',
    method: 'patch',
    path: '/notifications/read-all',
    auth: 'user',
    summary: 'Mark all as read',
    data: obj({ updated: { type: 'integer' }, unreadCount: { const: 0 } }),
  },
  {
    tag: 'Notifications',
    method: 'patch',
    path: '/notifications/{id}/read',
    auth: 'user',
    dto: notification.NotificationIdDTO,
    pathVars: { id: 'notificationId' },
    summary: 'Mark one as read',
    data: obj({ notificationId: id, unreadCount: { type: 'integer' } }),
  },
  {
    tag: 'Notifications',
    method: 'delete',
    path: '/notifications/{id}',
    auth: 'user',
    dto: notification.NotificationIdDTO,
    pathVars: { id: 'notificationId' },
    summary: 'Delete a notification',
  },

  // Conversations
  {
    tag: 'Conversations',
    method: 'get',
    path: '/conversations',
    auth: 'user',
    dto: chat.ListConversationsDTO,
    query: { page: '1', size: '20' },
    summary: 'Your conversations',
    description: 'Newest activity first, with `unreadCount` and online participants.',
    data: many('Conversation'),
    paged: true,
  },
  {
    tag: 'Conversations',
    method: 'post',
    path: '/conversations',
    auth: 'user',
    dto: chat.CreateConversationDTO,
    status: 201,
    summary: 'Start a direct chat or a group',
    description:
      'Direct: `participantIds: [otherUserId]` (an existing chat is returned instead of a duplicate). Group: `isGroup: true`, a `groupName` and ≥ 2 other people. Rate limited (60 writes / 15 min).',
    data: one('Conversation'),
    body: { participantIds: ['{{userId}}'] },
    save: ['conversationId=data._id'],
  },
  {
    tag: 'Conversations',
    method: 'get',
    path: '/conversations/{id}',
    auth: 'user',
    dto: chat.ConversationIdDTO,
    pathVars: { id: 'conversationId' },
    summary: 'A conversation with your membership',
    data: one('Conversation'),
  },
  {
    tag: 'Conversations',
    method: 'patch',
    path: '/conversations/{id}',
    auth: 'user',
    dto: chat.UpdateGroupDTO,
    pathVars: { id: 'conversationId' },
    summary: 'Update a group (admins)',
    description: 'Rename, change image, add or remove members. The owner cannot be removed.',
    data: one('Conversation'),
    body: { groupName: 'Weekend plans' },
  },
  {
    tag: 'Conversations',
    method: 'get',
    path: '/conversations/{id}/messages',
    auth: 'user',
    dto: chat.GetMessagesDTO,
    pathVars: { id: 'conversationId' },
    query: { page: '1', size: '30' },
    summary: 'Messages, newest first',
    data: many('Message'),
    paged: true,
  },
  {
    tag: 'Conversations',
    method: 'patch',
    path: '/conversations/{id}/mute',
    auth: 'user',
    dto: chat.MuteConversationDTO,
    pathVars: { id: 'conversationId' },
    summary: 'Mute or unmute',
    data: obj({ conversationId: id, isMuted: { type: 'boolean' } }),
    body: { muted: true },
  },
  {
    tag: 'Conversations',
    method: 'patch',
    path: '/conversations/{id}/read',
    auth: 'user',
    dto: chat.ReadConversationDTO,
    pathVars: { id: 'conversationId' },
    summary: 'Mark as read (up to `messageId`, or everything)',
    data: one('ReadReceipt'),
    body: {},
  },

  // Reports
  {
    tag: 'Reports',
    method: 'post',
    path: '/reports',
    auth: 'user',
    dto: report.CreateReportDTO,
    status: 201,
    summary: 'Report a user, post or comment',
    description: '409 if you already have an open report for it. Rate limited (60 writes / 15 min).',
    data: one('Report'),
    body: { targetType: 'post', targetId: '{{postId}}', reason: 'Spam', description: 'Posting the same link repeatedly.' },
    save: ['reportId=data._id'],
  },
  {
    tag: 'Reports',
    method: 'get',
    path: '/reports',
    auth: 'admin',
    dto: report.ListReportsDTO,
    query: { page: '1', size: '20', status: 'pending' },
    summary: 'All reports (admin)',
    data: many('Report'),
    paged: true,
  },
  {
    tag: 'Reports',
    method: 'get',
    path: '/reports/{id}',
    auth: 'user',
    dto: report.ReportIdDTO,
    pathVars: { id: 'reportId' },
    summary: 'A report (admin, or the reporter)',
    description: 'Other users get 404.',
    data: one('Report'),
  },
  {
    tag: 'Reports',
    method: 'patch',
    path: '/reports/{id}/review',
    auth: 'admin',
    dto: report.ReviewReportDTO,
    pathVars: { id: 'reportId' },
    summary: 'Review a report (admin)',
    data: one('Report'),
    body: { status: 'resolved' },
  },
];

// ── validation of examples ───────────────────────────────────────────────────────────────────────

const fillVars = (value) => JSON.parse(JSON.stringify(value).replace(/\{\{\w+\}\}/g, SAMPLE_ID));

for (const route of routes) {
  if (!route.dto) continue;
  const parts = route.dto.schema('en');
  if (route.body && parts.body) {
    const result = parts.body.safeParse(fillVars(route.body));
    if (!result.success) throw new Error(`Example body for ${route.method.toUpperCase()} ${route.path} is invalid: ${result.error.issues[0]?.message}`);
  }
  if (route.query && parts.query) {
    const result = parts.query.safeParse(route.query);
    if (!result.success) throw new Error(`Example query for ${route.method.toUpperCase()} ${route.path} is invalid: ${result.error.issues[0]?.message}`);
  }
}

// ── OpenAPI ──────────────────────────────────────────────────────────────────────────────────────

const toJson = (schema) => {
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any', target: 'draft-2020-12' });
  delete json.$schema;
  return json;
};

const errorResponse = (description) => ({ description, content: { 'application/json': { schema: ref('Error') } } });

const responses = {
  BadRequest: errorResponse('Validation failed (message code 201) or a bad request.'),
  Unauthorized: errorResponse('Missing, expired or revoked access token.'),
  Forbidden: errorResponse('Not allowed (e.g. not an admin, private account, not your resource).'),
  NotFound: errorResponse('Not found — also returned for blocked users and hidden content.'),
  Conflict: errorResponse('Already exists (e.g. duplicate report or account).'),
  TooManyRequests: errorResponse('Rate limited. See the `RateLimit` / `RateLimit-Policy` headers.'),
  ServiceUnavailable: errorResponse('Maintenance mode or the database/cache is unreachable.'),
};

function operation(route) {
  const parts = route.dto ? route.dto.schema('en') : {};
  const op = {
    tags: [route.tag],
    summary: route.summary,
    operationId: `${route.method}${route.path.replace(/\{(\w+)\}/g, 'By_$1').replace(/[^a-zA-Z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))}`,
    ...(route.description ? { description: route.description } : {}),
    parameters: [{ $ref: '#/components/parameters/AcceptLanguage' }],
    security: route.auth === 'none' ? [] : [{ bearerAuth: [] }],
    responses: {},
  };
  if (route.auth === 'admin') op.description = `${op.description ? `${op.description} ` : ''}Requires an **admin** access token.`;

  for (const [where, schema] of [
    ['path', parts.params],
    ['query', parts.query],
  ]) {
    if (!schema) continue;
    const json = toJson(schema);
    for (const [name, property] of Object.entries(json.properties ?? {})) {
      op.parameters.push({
        name,
        in: where,
        required: where === 'path' || (json.required ?? []).includes(name),
        schema: property,
        ...(where === 'query' && route.query?.[name] ? { example: route.query[name] } : {}),
      });
    }
  }
  // Path params without a DTO (none today, but keep OpenAPI valid).
  for (const [, name] of route.path.matchAll(/\{(\w+)\}/g)) {
    if (!op.parameters.some((p) => p.in === 'path' && p.name === name)) op.parameters.push({ name, in: 'path', required: true, schema: id });
  }

  if (route.upload) {
    op.requestBody = {
      required: true,
      content: {
        'multipart/form-data': { schema: { type: 'object', required: [route.upload], properties: { [route.upload]: { type: 'string', format: 'binary' } } } },
      },
    };
  } else if (parts.body) {
    op.requestBody = {
      required: true,
      content: { 'application/json': { schema: toJson(parts.body), ...(route.body ? { example: fillVars(route.body) } : {}) } },
    };
  }

  const success = route.raw
    ? (route.data ?? obj({}))
    : {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Localized success message.' },
          ...(route.data ? { data: route.data } : {}),
          ...(route.paged ? { meta: route.meta ?? ref('PageMeta') } : {}),
        },
      };
  op.responses[String(route.status ?? 200)] = { description: 'Success', content: { 'application/json': { schema: success } } };
  if (op.requestBody || parts.params || parts.query) op.responses['400'] = { $ref: '#/components/responses/BadRequest' };
  if (route.auth !== 'none') op.responses['401'] = { $ref: '#/components/responses/Unauthorized' };
  if (route.auth === 'admin' || /\{/.test(route.path)) op.responses['403'] = { $ref: '#/components/responses/Forbidden' };
  if (/\{/.test(route.path)) op.responses['404'] = { $ref: '#/components/responses/NotFound' };
  if (route.status === 201) op.responses['409'] = { $ref: '#/components/responses/Conflict' };
  if (route.path !== '/health') {
    op.responses['429'] = { $ref: '#/components/responses/TooManyRequests' };
    op.responses['503'] = { $ref: '#/components/responses/ServiceUnavailable' };
  }
  return op;
}

const SOCKET_DOCS = `
## Realtime (Socket.IO)

Connect with \`io(BASE_URL, { auth: { token: ACCESS_TOKEN } })\` (optionally \`auth.language: "ar"\`). Each socket joins
\`user:<id>\`; join \`conversation:<id>\` rooms with \`conversation:join\`. Client events take an ack callback that receives
\`{ ok: true, data }\` or \`{ ok: false, error, messageCode }\`. Not available on the Vercel deployment (no WebSockets).

| Client → Server | Payload |
| --- | --- |
| \`conversation:join\` / \`conversation:leave\` | \`{ conversationId }\` |
| \`message:send\` | \`{ conversationId, content?, type?, media?, replyTo?, clientId? }\` |
| \`message:edit\` | \`{ messageId, content }\` |
| \`message:delete\` | \`{ messageId }\` |
| \`message:read\` | \`{ conversationId, messageId? }\` |
| \`typing:start\` / \`typing:stop\` | \`{ conversationId }\` |
| \`notification:read\` | \`{ notificationId }\` |

| Server → Client | Payload |
| --- | --- |
| \`message:new\` | \`Message\` (+ \`clientId\` echoed) |
| \`message:delivered\` | \`{ conversationId, messageId, deliveredTo }\` |
| \`message:read:update\` | \`ReadReceipt\` |
| \`message:edited\` / \`message:deleted\` | \`{ conversationId, messageId, content?, editedAt? }\` |
| \`typing:update\` | \`{ conversationId, userId, isTyping }\` |
| \`conversation:updated\` | \`Conversation\` |
| \`presence:online\` / \`presence:offline\` / \`presence:update\` | \`{ userId, isOnline, lastSeenAt }\` |
| \`notification:new\` | \`{ notification, unreadCount }\` |
| \`notification:read:update\` | \`{ notificationId, unreadCount }\` or \`{ all: true, unreadCount: 0 }\` |
`;

const paths = {};
for (const route of routes) {
  paths[route.path] ??= {};
  paths[route.path][route.method] = operation(route);
}

const openapi = {
  openapi: '3.1.0',
  info: {
    title: `${APP.name} API`,
    version: pkg.version,
    summary: APP.summary,
    description: `${APP.description}

**Auth** — send \`Authorization: Bearer <access_token>\` from \`POST /auth/login\`. Tokens are single-session JWTs;
\`POST /auth/refresh\` rotates both. **Language** — \`Accept-Language: ar\` returns Arabic messages.
**Responses** — success: \`{ message, data?, meta? }\`; errors: \`{ errorMessage, error? }\`.
**Downloads** — [Postman collection](/docs/postman.json) · [OpenAPI JSON](/docs/swagger.json)
${SOCKET_DOCS}`,
  },
  servers: [
    { url: PRODUCTION_URL, description: 'Production (Vercel)' },
    { url: 'http://localhost:9090', description: 'Local development' },
  ],
  tags: TAGS,
  paths,
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Access token from `POST /auth/login`.' } },
    parameters: {
      AcceptLanguage: {
        name: 'Accept-Language',
        in: 'header',
        required: false,
        schema: { type: 'string', enum: ['en', 'ar'], default: 'en' },
        description: 'Language of `message` / `errorMessage`.',
      },
    },
    responses,
    schemas: models,
  },
};

// ── Postman ──────────────────────────────────────────────────────────────────────────────────────

const VARIABLES = ['baseUrl', 'accessToken', 'refreshToken', 'userId', 'postId', 'commentId', 'requestId', 'notificationId', 'conversationId', 'reportId'];

function postmanItem(route) {
  const vars = { ...route.pathVars };
  const segments = route.path
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(/\{(\w+)\}/, (_, name) => `{{${vars[name] ?? name}}}`));
  const query = Object.entries(route.query ?? {}).map(([key, value]) => ({ key, value }));
  const raw = `{{baseUrl}}/${segments.join('/')}${query.length ? `?${query.map((q) => `${q.key}=${q.value}`).join('&')}` : ''}`;

  const request = {
    method: route.method.toUpperCase(),
    header: [{ key: 'Accept-Language', value: 'en' }],
    url: { raw, host: ['{{baseUrl}}'], path: segments, ...(query.length ? { query } : {}) },
    description: [route.description, route.auth === 'admin' ? 'Requires an admin access token.' : null].filter(Boolean).join('\n\n'),
  };
  if (route.auth === 'none') request.auth = { type: 'noauth' };
  if (route.upload) {
    request.body = { mode: 'formdata', formdata: [{ key: route.upload, type: 'file', src: [] }] };
  } else if (route.body) {
    request.header.push({ key: 'Content-Type', value: 'application/json' });
    request.body = { mode: 'raw', raw: JSON.stringify(route.body, null, 2), options: { raw: { language: 'json' } } };
  }

  const item = { name: route.summary, request };
  if (route.save?.length) {
    item.event = [
      {
        listen: 'test',
        script: {
          type: 'text/javascript',
          exec: [
            'const body = pm.response.json();',
            ...route.save.map((rule) => {
              const [name, path] = rule.split('=');
              const access = path.replace(/^data/, 'body.data');
              return `try { const v = ${access}; if (v) pm.collectionVariables.set('${name}', v); } catch (e) {}`;
            }),
          ],
        },
      },
    ];
  }
  return item;
}

const postman = {
  info: {
    name: `${APP.name} API`,
    description: `${APP.description}\n\nSet \`baseUrl\`, run **Auth → Sign in**: the access/refresh tokens and created ids are stored in collection variables automatically.\nOpenAPI docs: {{baseUrl}}/docs`,
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }] },
  variable: VARIABLES.map((key) => ({ key, value: key === 'baseUrl' ? PRODUCTION_URL : '', type: 'string' })),
  item: TAGS.map((tag) => ({ name: tag.name, description: tag.description, item: routes.filter((route) => route.tag === tag.name).map(postmanItem) })),
};

// ── write ────────────────────────────────────────────────────────────────────────────────────────

mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'swagger.json'), `${JSON.stringify(openapi, null, 2)}\n`);
writeFileSync(resolve(outDir, 'postman.json'), `${JSON.stringify(postman, null, 2)}\n`);
console.log(`Wrote ${routes.length} routes → public/documentation/swagger.json, postman.json`);
