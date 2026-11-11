import { EventEmitter } from 'node:events';
import {
  forgotPasswordTemplate,
  mailService,
  verifyEmailTemplate,
} from '../service/mail.service.js';

interface OtpMailEvent {
  email: string;
  otp: number;
}

export class MailEvent extends EventEmitter {
  sendVerificationEmail(payload: OtpMailEvent): Promise<unknown> {
    return mailService.sendEmail({
      to: payload.email,
      subject: 'Verify your email',
      html: verifyEmailTemplate(payload),
    });
  }

  sendForgotPasswordEmail(payload: OtpMailEvent): Promise<unknown> {
    return mailService.sendEmail({
      to: payload.email,
      subject: 'Reset your password',
      html: forgotPasswordTemplate(payload),
    });
  }
}

export const mailEvent = new MailEvent();
