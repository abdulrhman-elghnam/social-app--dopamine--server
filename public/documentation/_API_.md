# Dopamine API Reference

REST API for the Dopamine social app (Express 5 + MongoDB + Redis), plus the Socket.IO realtime channel.

> Built from the route definitions in `source/app.ts` and `source/application/*/*.controller.ts`, and the zod DTOs in `source/application/*/dto/`.
> Interactive docs: `GET /docs` (Swagger UI), `GET /docs/swagger.json`, `GET /docs/postman.json`.

---

## Conventions

| Topic | Details |
| --- | --- |
| **Base URL** | `http://127.0.0.1:9090` in development |
| **Auth** | `Authorization: Bearer <access_token>`. 🔒 = needs an access token, 🛡️ = admin only (`ADMIN` role) |
| **Language** | `Accept-Language: en` or `ar` picks the language of `message` / `errorMessage` |
| **Success body** | `{ "message": string, "data"?: any, "meta"?: any }` |
| **Error body** | `{ "errorMessage": string, "error"?: string, ... }`. Validation errors are **400** with message code **201** |
| **Pagination** | Query `page` (int ≥ 1, default `1`) and `size` (int 1–50, default `10`). Paginated endpoints are marked 📄 |
| **IDs** | MongoDB ObjectId (24 hex characters) |
| **Blocking** | A block hides both users from each other everywhere. Blocked content returns **404**, never 403 |
| **Private accounts** | Their followers, following and posts return **403** (code 419) to anyone who doesn't follow them |
| **Soft delete** | Deleted posts and comments get a `deletedAt` timestamp instead of being removed from the database |

### Rate limits (per IP, stored in Redis; each one can be overridden with `RATE_LIMIT_<NAME>`)

| Name | Limit | Window | Applies to |
| --- | --- | --- | --- |
| `global` | 1500 | 15 min | Every route after `/health` and `/docs` |
| `auth` | 20 (only failed requests count) | 15 min | register, login, google |
| `refresh` | 100 | 15 min | refresh |
| `otp` | 15 | 15 min | verify-otp, forgot-password, verify-forgot-password, change-password |
| `write` | 300 | 15 min | create post / comment / share / conversation / report, send follow request |
| `upload` | 30 | 60 min | avatar and cover image uploads |

### Enums

| Enum | Values |
| --- | --- |
| Gender (signup / profile) | `MALE`, `FEMALE` |
| Post visibility | `public`, `followers`, `private` |
| Account privacy (`privacyController`) | `public`, `private` |
| Logout type | `SINGLE` (default), `ALL` |
| Report target type | `user`, `post`, `comment` |
| Report status | `pending`, `reviewed`, `resolved`, `rejected` |
| Notification type | `follow`, `follow_request`, `follow_accepted`, `like`, `comment`, `reply`, `comment_like`, `share` |
| Message type | `text`, `image`, `video`, `audio`, `file` |
| Media type | `image`, `text` |

### Endpoint count

| Module | Base path | Endpoints |
| --- | --- | --- |
| System | `/`, `/health`, `/docs` | 5 |
| Auth | `/auth` | 9 |
| Users | `/users` | 14 |
| Follow requests | `/follow-requests` | 6 |
| Posts | `/posts` | 10 |
| Comments | `/posts/:postId/comments`, `/comments` | 7 |
| Notifications | `/notifications` | 4 |
| Conversations | `/conversations` | 7 |
| Reports | `/reports` | 4 |
| **Total REST** | | **66** |

---

## 1. System

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | — | Liveness check. Returns `{ status: "ok", uptime }` and doesn't touch the database or Redis. |
| `GET` | `/` | — | Welcome message (code 101). |
| `GET` | `/docs` | — | Swagger UI. Turn it off with `DOCS_ENABLED=false`. |
| `GET` | `/docs/swagger.json` | — | OpenAPI document. |
| `GET` | `/docs/postman.json` | — | Postman collection. |
| `GET` | `/assets/*` | — | Static uploaded files (avatars, cover images). |
| `*` | *(anything else)* | — | **404** catch-all. |

> When `MAINTENANCE_MODE="true"`, every request returns **503** with a `Retry-After` header. If MongoDB or Redis can't be reached, requests after `/health` return **503** and the connection is retried on the next request.

---

## 2. Auth — `/auth`

| Method | Path | Auth | Rate limit | Description |
| --- | --- | --- | --- | --- |
| `POST` | `/auth/register` | — | auth | Creates a local account and emails a 6-digit verification code. Confirm it with `/auth/verify-otp` before logging in. |
| `POST` | `/auth/verify-otp` | — | otp | Verifies the email address with the emailed code. |
| `POST` | `/auth/login` | — | auth | Signs in with email and password. Returns `access_token` + `refresh_token`. |
| `POST` | `/auth/google` | — | auth | Signs in, or signs up, with a Google ID token. Returns a token pair. |
| `POST` | `/auth/refresh` | 🔒 | refresh | Rotates tokens. The refresh token works **once**: it is revoked and a new pair is returned. |
| `POST` | `/auth/logout` | 🔒 | — | `SINGLE` revokes the current access token (and the given refresh token). `ALL` revokes every session. |
| `POST` | `/auth/forgot-password` | — | otp | Emails a password-reset code. |
| `POST` | `/auth/verify-forgot-password` | — | otp | Checks a password-reset code without using it up. |
| `POST` | `/auth/change-password` | — | otp | Sets a new password using the reset code, then **revokes every session**. |

### Request bodies

**`POST /auth/register`**
| Field | Type | Rules |
| --- | --- | --- |
| `email` | string | valid email, lower-cased |
| `username` | string | 3–30 characters, `[a-zA-Z0-9_]` |
| `password` | string | 8–30 characters with a lowercase letter, an uppercase letter, a digit and one of `@$!%*?&` |
| `confirmPassword` | string | must equal `password` |
| `fullName` | string | 3–30 letters (spaces, `'` and `-` allowed between words) |
| `gender` | enum | `MALE` \| `FEMALE` |
| `phoneNumber` | string | Egyptian mobile number: `01[0125]xxxxxxxx` or `+201[0125]xxxxxxxx` |
| `DOB` | date | age 18–100 |

**`POST /auth/login`** — `{ email, password }`

**`POST /auth/google`** — `{ idToken }`

**`POST /auth/verify-otp`**, **`POST /auth/verify-forgot-password`** — `{ email, otp }` (`otp` = 6 digits)

**`POST /auth/forgot-password`** — `{ email }`

**`POST /auth/change-password`** — `{ email, otp, password, confirmPassword }`

**`POST /auth/refresh`** — `{ refreshToken }`

**`POST /auth/logout`** — `{ type?: "SINGLE" | "ALL", refreshToken?: string }` (no other fields allowed)

---

## 3. Users — `/users`

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/users/me` | 🔒 | Your full profile. |
| `PATCH` | `/users/me` | 🔒 | Updates your profile. Send at least one field. |
| `PATCH` | `/users/me/avatar` | 🔒 · upload | Uploads your avatar (multipart field `avatar`, image, max 5 MB). The old file is deleted. |
| `PATCH` | `/users/me/cover-image` | 🔒 · upload | Uploads your cover image (multipart field `coverImage`, image, max 5 MB). The old file is deleted. |
| `GET` | `/users/me/blocked` | 🔒 📄 | Users you've blocked, newest first. |
| `GET` | `/users/search` | 🔒 📄 | Searches users by name or username (`q`, 1–50 characters). |
| `GET` | `/users/suggestions` | 🔒 📄 | People you may know. |
| `GET` | `/users/:userId` | 🔒 | A user's profile with your relationship to them. For a private account you don't follow, only a limited card is returned (`isRestricted: true`). |
| `GET` | `/users/:userId/followers` | 🔒 📄 | The user's followers. **403** for a private account you don't follow. |
| `GET` | `/users/:userId/following` | 🔒 📄 | Who the user follows. **403** for a private account you don't follow. |
| `GET` | `/users/:userId/posts` | 🔒 📄 | The user's posts that you're allowed to see. **403** for a private account you don't follow. |
| `POST` | `/users/:userId/block` | 🔒 | Blocks a user: hides you from each other and removes follows in both directions. |
| `DELETE` | `/users/:userId/block` | 🔒 | Unblocks a user. |
| `DELETE` | `/users/:userId/follow` | 🔒 | Unfollows a user and retracts the follow notification. |

### `PATCH /users/me` body (all fields optional, no other fields allowed)
| Field | Rules |
| --- | --- |
| `firstName`, `lastName` | 2–30 letters |
| `username` | 3–30 characters, `[a-zA-Z0-9_]` |
| `bio` | ≤ 500 characters |
| `phone` | Egyptian mobile number |
| `DOB` | age 18–100 |
| `gender` | `MALE` \| `FEMALE` |
| `privacyController` | `public` \| `private` |

---

## 4. Follow requests — `/follow-requests`

Following a public account happens immediately. Following a private account creates a request that the owner accepts or rejects.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/follow-requests/received` | 🔒 📄 | Pending requests sent to you. |
| `GET` | `/follow-requests/sent` | 🔒 📄 | Your pending outgoing requests. |
| `POST` | `/follow-requests/:userId` | 🔒 · write | Follows a user. Returns `status: "following"` for a public account or `"requested"` for a private one. |
| `PATCH` | `/follow-requests/:requestId/accept` | 🔒 | Accepts a request sent to you; the sender becomes your follower and is notified. |
| `PATCH` | `/follow-requests/:requestId/reject` | 🔒 | Rejects a request sent to you. |
| `DELETE` | `/follow-requests/:requestId` | 🔒 | Cancels a request you sent and retracts its notification. |

---

## 5. Posts — `/posts`

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/posts` | 🔒 📄 | Home feed: your posts plus posts from people you follow, newest first. Each post includes `isLiked` / `isSaved`. |
| `POST` | `/posts` | 🔒 · write | Creates a post. |
| `GET` | `/posts/:postId` | 🔒 | A single post, if you're allowed to see it. |
| `PATCH` | `/posts/:postId` | 🔒 | Edits your post. Send at least one field. |
| `DELETE` | `/posts/:postId` | 🔒 | Soft-deletes your post; its comments go with it. |
| `POST` | `/posts/:postId/like` | 🔒 | Likes a post and notifies the author. |
| `DELETE` | `/posts/:postId/like` | 🔒 | Unlikes a post and retracts the notification. |
| `POST` | `/posts/:postId/save` | 🔒 | Saves a post to your bookmarks. |
| `DELETE` | `/posts/:postId/save` | 🔒 | Removes a post from your bookmarks. |
| `POST` | `/posts/:postId/share` | 🔒 · write | Shares a post with an optional caption. Only public posts or your own posts can be shared. |

### Bodies
**`POST /posts`** — `{ content: string (1–5000), visibility?: "public" | "followers" | "private", commentsEnabled?: boolean }`

**`PATCH /posts/:postId`** — any non-empty subset of `{ content, visibility, commentsEnabled }`

**`POST /posts/:postId/share`** — `{ content?: string (≤ 1000) }`

---

## 6. Comments — `/posts/:postId/comments` and `/comments`

Replies go one level deep: a reply's parent must be a top-level comment.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/posts/:postId/comments` | 🔒 📄 | Top-level comments on a post. |
| `POST` | `/posts/:postId/comments` | 🔒 · write | Adds a comment, or a reply when `parentCommentId` is set. Notifies the post or comment author. |
| `PATCH` | `/comments/:commentId` | 🔒 | Edits your comment. |
| `DELETE` | `/comments/:commentId` | 🔒 | Soft-deletes a comment and its replies. Allowed for the comment's author or the post's owner. |
| `POST` | `/comments/:commentId/like` | 🔒 | Likes a comment. |
| `DELETE` | `/comments/:commentId/like` | 🔒 | Unlikes a comment. |
| `GET` | `/comments/:commentId/replies` | 🔒 📄 | Replies to a comment, oldest first. |

### Bodies
**`POST /posts/:postId/comments`** — `{ content: string (1–2000), parentCommentId?: ObjectId }`

**`PATCH /comments/:commentId`** — `{ content: string (1–2000) }`

---

## 7. Notifications — `/notifications`

Created when someone follows you, sends you a follow request, accepts yours, likes, comments, replies or shares. They're also pushed live over the socket as `notification:new`.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/notifications` | 🔒 📄 | Your notifications. Add `?unread=true` for unread only. `meta.unreadCount` holds the unread total. |
| `PATCH` | `/notifications/read-all` | 🔒 | Marks every notification as read. |
| `PATCH` | `/notifications/:id/read` | 🔒 | Marks one notification as read. |
| `DELETE` | `/notifications/:id` | 🔒 | Deletes one notification. |

---

## 8. Conversations — `/conversations`

Conversations are managed over REST. Messages are sent, edited and deleted over Socket.IO ([section 10](#10-realtime-socketio)).

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/conversations` | 🔒 📄 | Your conversations, most recent activity first, with `unreadCount` and online participants. |
| `POST` | `/conversations` | 🔒 · write | Starts a direct chat or a group. If a direct chat with that person already exists, it is returned instead of creating a duplicate. |
| `GET` | `/conversations/:id` | 🔒 | One conversation, including your membership (`lastReadMessage`, mute state). |
| `PATCH` | `/conversations/:id` | 🔒 | Updates a group (group admins only): rename it, change its image, add or remove members. The owner can't be removed. |
| `GET` | `/conversations/:id/messages` | 🔒 📄 | Messages, newest first. |
| `PATCH` | `/conversations/:id/mute` | 🔒 | Mutes or unmutes the conversation for you. |
| `PATCH` | `/conversations/:id/read` | 🔒 | Marks messages as read up to `messageId`, or up to the latest message if it's omitted. |

### Bodies
**`POST /conversations`**
| Field | Rules |
| --- | --- |
| `participantIds` | 1–50 user ids, not including you |
| `isGroup` | boolean, default `false` |
| `groupName` | 1–50 characters, required when `isGroup` is true |
| `groupImage` | URL, optional |

Direct chat: `participantIds` has exactly 1 other user. Group: `isGroup: true`, a `groupName` and at least 2 other users.

**`PATCH /conversations/:id`** — any non-empty subset of `{ groupName, groupImage, addMembers: ObjectId[], removeMembers: ObjectId[] }`

**`PATCH /conversations/:id/mute`** — `{ muted: boolean }`

**`PATCH /conversations/:id/read`** — `{ messageId?: ObjectId }`

---

## 9. Reports — `/reports`

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/reports` | 🔒 · write | Reports a user, post or comment. **409** if you already have an open report on the same target. |
| `GET` | `/reports` | 🔒 🛡️ 📄 | Lists all reports (admin). Filter with `?status=` and `?targetType=`. |
| `GET` | `/reports/:id` | 🔒 | One report. Visible to admins and the reporter; anyone else gets **404**. |
| `PATCH` | `/reports/:id/review` | 🔒 🛡️ | Moves a report out of `pending` (admin). |

### Bodies
**`POST /reports`** — `{ targetType: "user" | "post" | "comment", targetId: ObjectId, reason: string (3–100), description?: string (≤ 1000) }`

**`PATCH /reports/:id/review`** — `{ status: "reviewed" | "resolved" | "rejected" }`

---

## 10. Realtime (Socket.IO)

Connect to the API's own host with `auth: { token: <access_token> }`. On connect, the socket joins the room `user:<userId>`. Socket.IO isn't available when the API runs on Vercel.

Client events are acknowledged with `{ ok: true, data }` or `{ ok: false, error, messageCode }`.

### Client → Server

| Event | Payload | Description |
| --- | --- | --- |
| `conversation:join` | `{ conversationId }` | Joins a conversation room to receive typing and live events. |
| `conversation:leave` | `{ conversationId }` | Leaves the conversation room. |
| `message:send` | `{ conversationId, content?, type?, media?: [{ url, type }] (≤ 10), replyTo?, clientId? }` | Sends a message; needs `content` or at least one `media` item. `clientId` comes back in `message:new` so the sender can match it to their optimistic bubble. |
| `message:edit` | `{ messageId, content }` | Edits your message (content ≤ 5000 characters). |
| `message:delete` | `{ messageId }` | Deletes your message. |
| `message:read` | `{ conversationId, messageId? }` | Marks messages as read up to `messageId`, or up to the latest message. |
| `typing:start` | `{ conversationId }` | Tells the conversation room you started typing. |
| `typing:stop` | `{ conversationId }` | Tells the conversation room you stopped typing. |
| `notification:read` | `{ notificationId }` | Marks a notification as read. |

### Server → Client

| Event | Payload | Description |
| --- | --- | --- |
| `message:new` | message | A new message in one of your conversations. |
| `message:delivered` | `{ conversationId, messageId, deliveredTo[] }` | A message reached online members. |
| `message:read:update` | `{ conversationId, userId, messageId, readAt }` | A member read messages. |
| `message:edited` | `{ conversationId, messageId, content, editedAt }` | A message was edited. |
| `message:deleted` | `{ conversationId, messageId }` | A message was deleted. |
| `typing:update` | `{ conversationId, userId, isTyping }` | Someone started or stopped typing. |
| `conversation:updated` | conversation | A group was renamed, its image changed, or its members changed. |
| `presence:online` / `presence:offline` / `presence:update` | `{ userId, isOnline, lastSeenAt }` | A contact came online or went offline. |
| `notification:new` | `{ notification, unreadCount }` | A new notification for you. |
| `notification:read:update` | `{ notificationId, unreadCount }` or `{ all: true, unreadCount }` | Notifications were marked as read (keeps your other devices in sync). |
