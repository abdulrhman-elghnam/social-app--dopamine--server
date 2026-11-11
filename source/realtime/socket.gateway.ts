import type { Server } from 'socket.io';
import { Rooms, type ClientToServerEvents, type ServerPayload, type ServerToClientEvents, type SocketData } from './socket.events.js';

export type AppServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type Event = keyof ServerToClientEvents;
type Id = string | { toString(): string };

/**
 * Process-wide access point to Socket.IO for HTTP services (notifications, REST-side effects)
 * and the socket handlers. Holds no handler logic, so services can import it without cycles.
 *
 * Presence is tracked in memory (userId → open socket count). With several Node processes
 * (pm2 cluster) this needs the Socket.IO Redis adapter + a shared presence store.
 */

class SocketGateway {
  private io: AppServer | null = null;
  private readonly connections = new Map<string, number>();

  bind(io: AppServer): void {
    this.io = io;
  }

  get server(): AppServer | null {
    return this.io;
  }

  emitToUser<E extends Event>(userId: Id, event: E, payload: ServerPayload<E>): void {
    this.io?.to(Rooms.user(String(userId))).emit(event, ...([payload] as Parameters<ServerToClientEvents[E]>));
  }

  emitToUsers<E extends Event>(userIds: Id[], event: E, payload: ServerPayload<E>): void {
    if (!this.io || !userIds.length) return;
    this.io.to(userIds.map((id) => Rooms.user(String(id)))).emit(event, ...([payload] as Parameters<ServerToClientEvents[E]>));
  }

  emitToConversation<E extends Event>(conversationId: Id, event: E, payload: ServerPayload<E>): void {
    this.io?.to(Rooms.conversation(String(conversationId))).emit(event, ...([payload] as Parameters<ServerToClientEvents[E]>));
  }

  /**
   * Emits once to the conversation room plus each member's personal room. Socket.IO
   * de-duplicates across rooms in one `to([...])`, so a socket in both gets it once —
   * members viewing the inbox (not joined to the room) still receive it.
   */
  emitToConversationMembers<E extends Event>(conversationId: Id, memberIds: Id[], event: E, payload: ServerPayload<E>): void {
    this.io
      ?.to([Rooms.conversation(String(conversationId)), ...memberIds.map((id) => Rooms.user(String(id)))])
      .emit(event, ...([payload] as Parameters<ServerToClientEvents[E]>));
  }

  /** Records a new socket; true when this is the user's first open connection (just came online). */
  addConnection(userId: string): boolean {
    const count = (this.connections.get(userId) ?? 0) + 1;
    this.connections.set(userId, count);
    return count === 1;
  }

  /** Records a closed socket; true when the user has no open connections left (went offline). */
  removeConnection(userId: string): boolean {
    const count = (this.connections.get(userId) ?? 1) - 1;
    if (count <= 0) {
      this.connections.delete(userId);
      return true;
    }
    this.connections.set(userId, count);
    return false;
  }

  isOnline(userId: Id): boolean {
    return this.connections.has(String(userId));
  }

  onlineAmong(userIds: Id[]): string[] {
    return userIds.map(String).filter((id) => this.connections.has(id));
  }
}

export const socketGateway = new SocketGateway();
