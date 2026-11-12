import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import type { ZodType } from 'zod';
import type { Types } from 'mongoose';

import { conversationService } from '../application/chat/conversation.service.js';
import { messageSchemas } from '../application/chat/dto/message.dto.js';
import { messageService } from '../application/chat/message.service.js';
import { notificationService } from '../application/notification/notification.service.js';
import { conversationRepository } from '../database/repository/conversation.repository.js';
import { userRepository } from '../database/repository/user.repository.js';
import { AppError } from '../dependency/exception/app.exception.js';
import { languageService } from '../dependency/service/language.service.js';
import { tokenService } from '../dependency/service/token.service.js';
import { utilService } from '../dependency/service/util.service.js';
import { ApiLanguage } from '../dependency/value/system.enum.js';
import { TokenTypeEnum } from '../dependency/value/security.enum.js';
import { socketGateway, type AppServer } from './socket.gateway.js';
import { Rooms, SocketEvents, type Ack, type ClientEventName, type ClientToServerEvents, type ServerToClientEvents, type SocketData } from './socket.events.js';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

class SocketServer {
  attach(httpServer: HttpServer): Server {
    const io: AppServer = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, { cors: { origin: '*' } });
    socketGateway.bind(io);

    io.use(async (socket, next) => {
      try {
        const raw = String(socket.handshake.auth['token'] ?? socket.handshake.headers.authorization ?? '');
        if (!raw) throw new Error('Authentication required');
        const payload = await tokenService.decodeToken(/^Bearer\s/i.test(raw) ? raw : `Bearer ${raw}`, TokenTypeEnum.ACCESS);
        socket.data.userId = payload.sub as string;
        socket.data.language = String(socket.handshake.auth['language'] ?? socket.handshake.headers['accept-language'] ?? ApiLanguage.ENGLISH);
        next();
      } catch {
        next(new Error('Unauthorized'));
      }
    });

    io.on('connection', (socket) => void this.onConnection(socket));
    return io;
  }

  private async onConnection(socket: AppSocket): Promise<void> {
    const { userId } = socket.data;
    const me = utilService.toObjectId(userId);
    const schemas = messageSchemas(socket.data.language.toLowerCase().startsWith('ar') ? ApiLanguage.ARABIC : ApiLanguage.ENGLISH);

    await socket.join(Rooms.user(userId));
    if (socketGateway.addConnection(userId)) await this.broadcastPresence(me, true);

    const on = <T>(event: ClientEventName, schema: ZodType<T>, handler: (input: T) => Promise<unknown>) => {
      socket.on(event, async (raw: unknown, ack?: Ack) => {
        const reply = typeof ack === 'function' ? ack : () => undefined;
        const parsed = schema.safeParse(raw);
        if (!parsed.success) return reply({ ok: false, error: parsed.error.issues[0]?.message ?? 'validation failed', messageCode: 201 });
        try {
          const data = await handler(parsed.data);
          reply({ ok: true, ...(data === undefined ? {} : { data }) });
        } catch (error) {
          const messageCode = (error instanceof AppError ? error.messageCode : undefined) ?? 103;
          reply({ ok: false, messageCode, error: languageService.chooseLanguage(socket.data.language, messageCode) });
        }
      });
    };

    on(SocketEvents.CONVERSATION_JOIN, schemas.conversation, async ({ conversationId }) => {
      await conversationService.findMembership(conversationId, me);
      await socket.join(Rooms.conversation(conversationId));
      return { conversationId };
    });

    on(SocketEvents.CONVERSATION_LEAVE, schemas.conversation, async ({ conversationId }) => {
      await socket.leave(Rooms.conversation(conversationId));
      return { conversationId };
    });

    on(SocketEvents.MESSAGE_SEND, schemas.send, (input) => messageService.send(input, me));
    on(SocketEvents.MESSAGE_EDIT, schemas.edit, (input) => messageService.edit(input, me));
    on(SocketEvents.MESSAGE_DELETE, schemas.remove, (input) => messageService.remove(input, me));
    on(SocketEvents.MESSAGE_READ, schemas.read, ({ conversationId, messageId }) => conversationService.markRead(conversationId, me, messageId));

    const typing = (isTyping: boolean) =>
      async ({ conversationId }: { conversationId: string }) => {
        await conversationService.findMembership(conversationId, me);
        socket.to(Rooms.conversation(conversationId)).emit(SocketEvents.TYPING_UPDATE, { conversationId, userId, isTyping });
      };
    on(SocketEvents.TYPING_START, schemas.conversation, typing(true));
    on(SocketEvents.TYPING_STOP, schemas.conversation, typing(false));

    on(SocketEvents.NOTIFICATION_READ, schemas.notificationRead, async ({ notificationId }) => ({
      notificationId,
      unreadCount: await notificationService.markRead(notificationId, me),
    }));

    socket.on('disconnect', () => {
      if (!socketGateway.removeConnection(userId)) return;
      void (async () => {
        try {
          await userRepository.updateOne({ filter: { _id: me }, data: { $set: { lastSeenAt: new Date() } } });
          await this.broadcastPresence(me, false);
        } catch (error) {
          console.error('[socket] disconnect bookkeeping failed', error);
        }
      })();
    });
  }

  private async broadcastPresence(user: Types.ObjectId, online: boolean): Promise<void> {
    const contacts = await conversationRepository.contactIds(user);
    if (!contacts.length) return;
    const lastSeenAt = online ? null : new Date();
    const state = { userId: String(user), isOnline: online, lastSeenAt };
    socketGateway.emitToUsers(contacts, online ? SocketEvents.PRESENCE_ONLINE : SocketEvents.PRESENCE_OFFLINE, state);
    socketGateway.emitToUsers(contacts, SocketEvents.PRESENCE_UPDATE, state);
  }
}

export const socketServer = new SocketServer();
