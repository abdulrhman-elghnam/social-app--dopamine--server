import type { Types } from 'mongoose';

export const SocketEvents = {

  CONVERSATION_JOIN: 'conversation:join',
  CONVERSATION_LEAVE: 'conversation:leave',
  MESSAGE_SEND: 'message:send',
  MESSAGE_READ: 'message:read',
  MESSAGE_EDIT: 'message:edit',
  MESSAGE_DELETE: 'message:delete',
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',

  MESSAGE_NEW: 'message:new',
  MESSAGE_DELIVERED: 'message:delivered',
  MESSAGE_READ_UPDATE: 'message:read:update',
  MESSAGE_EDITED: 'message:edited',
  MESSAGE_DELETED: 'message:deleted',
  TYPING_UPDATE: 'typing:update',

  CONVERSATION_UPDATED: 'conversation:updated',
  
  PRESENCE_ONLINE: 'presence:online',
  PRESENCE_OFFLINE: 'presence:offline',
  PRESENCE_UPDATE: 'presence:update',
  
  NOTIFICATION_NEW: 'notification:new',
  NOTIFICATION_READ: 'notification:read',
  NOTIFICATION_READ_UPDATE: 'notification:read:update',
} as const;

export const Rooms = {
  user: (userId: string) => `user:${userId}`,
  conversation: (conversationId: string) => `conversation:${conversationId}`,
};

type Id = string | Types.ObjectId;

export type AckResponse<T = unknown> = { ok: true; data?: T } | { ok: false; error: string; messageCode?: number };
export type Ack<T = unknown> = (response: AckResponse<T>) => void;

type Values<T> = T[keyof T];
type ClientEventKey =
  | 'CONVERSATION_JOIN'
  | 'CONVERSATION_LEAVE'
  | 'MESSAGE_SEND'
  | 'MESSAGE_READ'
  | 'MESSAGE_EDIT'
  | 'MESSAGE_DELETE'
  | 'TYPING_START'
  | 'TYPING_STOP'
  | 'NOTIFICATION_READ';
export type ClientEventName = (typeof SocketEvents)[ClientEventKey];
export type ServerEventName = Exclude<Values<typeof SocketEvents>, ClientEventName>;

export type ClientToServerEvents = Record<ClientEventName, (payload: unknown, ack?: Ack) => void>;

export interface TypingUpdatePayload {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}
export interface PresencePayload {
  userId: string;
  isOnline: boolean;
  lastSeenAt: Date | null;
}
export interface MessageReadUpdatePayload {
  conversationId: Id;
  userId: Id;
  messageId: Id | null;
  readAt: Date;
}
export interface MessageDeliveredPayload {
  conversationId: Id;
  messageId: Id;
  deliveredTo: Id[];
}
export interface MessageEditedPayload {
  conversationId: Id;
  messageId: Id;
  content: string | undefined;
  editedAt: Date | undefined;
}
export interface MessageDeletedPayload {
  conversationId: Id;
  messageId: Id;
}
export interface NotificationNewPayload {
  notification: unknown;
  unreadCount: number;
}
export type NotificationReadUpdatePayload = { notificationId: string; unreadCount: number } | { all: true; unreadCount: number };

export interface ServerToClientEvents {
  'message:new': (message: unknown) => void;
  'message:delivered': (payload: MessageDeliveredPayload) => void;
  'message:read:update': (payload: MessageReadUpdatePayload) => void;
  'message:edited': (payload: MessageEditedPayload) => void;
  'message:deleted': (payload: MessageDeletedPayload) => void;
  'typing:update': (payload: TypingUpdatePayload) => void;
  'conversation:updated': (conversation: unknown) => void;
  'presence:online': (payload: PresencePayload) => void;
  'presence:offline': (payload: PresencePayload) => void;
  'presence:update': (payload: PresencePayload) => void;
  'notification:new': (payload: NotificationNewPayload) => void;
  'notification:read:update': (payload: NotificationReadUpdatePayload) => void;
}

type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
export const serverEventsCovered: Exact<keyof ServerToClientEvents, ServerEventName> = true;

export type ServerPayload<E extends keyof ServerToClientEvents> = Parameters<ServerToClientEvents[E]>[0];

export interface SocketData {
  userId: string;
  language: string;
}
