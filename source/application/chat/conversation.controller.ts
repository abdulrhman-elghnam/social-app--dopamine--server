import { Router } from 'express';
import type { Request, Router as RouterType } from 'express';
import type { JwtPayload } from 'jsonwebtoken';

import { authGuard } from '../../dependency/guard/auth.guard.js';
import { validationPipe } from '../../dependency/pipe/validation.pipe.js';
import { utilService } from '../../dependency/service/util.service.js';
import { TokenTypeEnum } from '../../dependency/value/security.enum.js';
import { conversationService } from './conversation.service.js';
import {
  ConversationIdDTO,
  CreateConversationDTO,
  GetMessagesDTO,
  ListConversationsDTO,
  MuteConversationDTO,
  ReadConversationDTO,
  UpdateGroupDTO,
  type ConversationIdParams,
  type CreateConversationBody,
  type GetMessagesQuery,
  type ListConversationsQuery,
  type MuteConversationBody,
  type ReadConversationBody,
  type UpdateGroupBody,
} from './dto/conversation.dto.js';

/** Mounted at `/conversations`. Sending/editing/deleting messages happens over Socket.IO. */
class ConversationController {
  public readonly route: RouterType = Router({ caseSensitive: true, strict: true });

  constructor() {
    const auth = authGuard.check(TokenTypeEnum.ACCESS);
    const id = (req: Request) => (req.validated!.params as ConversationIdParams).id;

    this.route.get(
      '/',
      auth,
      validationPipe.schema(ListConversationsDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) => conversationService.list(req.validated!.query as ListConversationsQuery, req.payload as JwtPayload),
      }),
    );

    this.route.post(
      '/',
      auth,
      validationPipe.schema(CreateConversationDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) => conversationService.create(req.validated!.body as CreateConversationBody, req.payload as JwtPayload),
      }),
    );

    this.route.get(
      '/:id',
      auth,
      validationPipe.schema(ConversationIdDTO.schema),
      utilService.responseFormatter({ handler: (req: Request) => conversationService.get(id(req), req.payload as JwtPayload) }),
    );

    this.route.patch(
      '/:id',
      auth,
      validationPipe.schema(UpdateGroupDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) => conversationService.updateGroup(id(req), req.validated!.body as UpdateGroupBody, req.payload as JwtPayload),
      }),
    );

    this.route.get(
      '/:id/messages',
      auth,
      validationPipe.schema(GetMessagesDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) => conversationService.messages(id(req), req.validated!.query as GetMessagesQuery, req.payload as JwtPayload),
      }),
    );

    this.route.patch(
      '/:id/mute',
      auth,
      validationPipe.schema(MuteConversationDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) => conversationService.mute(id(req), req.validated!.body as MuteConversationBody, req.payload as JwtPayload),
      }),
    );

    this.route.patch(
      '/:id/read',
      auth,
      validationPipe.schema(ReadConversationDTO.schema),
      utilService.responseFormatter({
        handler: (req: Request) =>
          conversationService.markReadHandler(id(req), (req.validated!.body as ReadConversationBody).messageId, req.payload as JwtPayload),
      }),
    );
  }
}

export const conversationController = new ConversationController();
