import { z } from 'zod';

import { generalValidationFields, translator } from '../../../dependency/pipe/validation.pipe.js';
import { MediaTypeEnum, MessageTypeEnum } from '../../../dependency/value/database.enum.js';
import { ApiLanguage } from '../../../dependency/value/system.enum.js';

/**
 * Socket payload schemas (validated in the socket handlers, not by the HTTP pipe).
 * Messages use the socket's handshake language.
 */
export const messageSchemas = (language: ApiLanguage) => {
  const t = translator(language);
  const objectId = generalValidationFields.objectId(t);
  const content = z
    .string({ message: t(238) })
    .trim()
    .max(5000, { message: t(244) });

  return {
    conversation: z.object({ conversationId: objectId }),
    send: z
      .object({
        conversationId: objectId,
        content: content.optional(),
        type: z.enum(MessageTypeEnum, { message: t(257) }).default(MessageTypeEnum.TEXT),
        media: z
          .array(z.object({ url: z.url({ message: t(248) }), type: z.enum(MediaTypeEnum, { message: t(257) }) }))
          .max(10, { message: t(255) })
          .default([]),
        replyTo: objectId.optional(),
        /** Echoed back in `message:new` so the sender can reconcile an optimistic bubble. */
        clientId: z.string().max(64).optional(),
      })
      .refine((data) => Boolean(data.content) || data.media.length > 0, { message: t(1215) }),
    edit: z.object({ messageId: objectId, content: content.min(1, { message: t(1215) }) }),
    remove: z.object({ messageId: objectId }),
    read: z.object({ conversationId: objectId, messageId: objectId.optional() }),
    notificationRead: z.object({ notificationId: objectId }),
  };
};

type Schemas = ReturnType<typeof messageSchemas>;
export type SendMessageInput = z.infer<Schemas['send']>;
export type EditMessageInput = z.infer<Schemas['edit']>;
export type DeleteMessageInput = z.infer<Schemas['remove']>;
export type ReadMessagesInput = z.infer<Schemas['read']>;
