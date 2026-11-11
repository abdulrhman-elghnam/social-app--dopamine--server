import nodemailer, {
  type SendMailOptions,
  type SentMessageInfo,
  type Transporter,
} from 'nodemailer';
import { configService } from './config.service.js';

export interface SendEmailOptions {
  to: SendMailOptions['to'];
  subject: string;
  text?: string;
  html?: string;
}

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      })[character] ?? character
  );

export class MailService {
  private readonly transporter: Transporter<SentMessageInfo>;
  private readonly sender: string;

  constructor() {
    this.sender = configService.getOrThrow('APP_MAIL');
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.sender,
        pass: configService.getOrThrow('APP_PASSWORD'),
      },
    });
  }

  sendEmail(options: SendEmailOptions): Promise<SentMessageInfo> {
    if (!options.text && !options.html) {
      return Promise.reject(new Error('Email text or HTML content is required'));
    }

    return this.transporter.sendMail({
      from: this.sender,
      ...options,
    });
  }
}

export const verifyEmailTemplate = ({ otp, email }: { otp: number; email: string }) => `
<!DOCTYPE html>
<html lang="en">
<body style="font-family: Arial; text-align: center; padding: 40px;">
  <h1>Hi ${escapeHtml(email)}</h1>
  <h2>Verify Your Email</h2>
  <p>Click below to verify your email address.</p>

  <div
    style="
      display: inline-block;
      padding: 14px 28px;
      background: #171717;
      color: white;
      text-decoration: none;
      border-radius: 6px;
    "
  >
     otp : ${otp}
  </div>

</body>
</html>
`;

export const forgotPasswordTemplate = ({ otp, email }: { otp: number; email: string }) => `
<!DOCTYPE html>
<html lang="en">
<body style="font-family: Arial; text-align: center; padding: 40px;">
  <h1>Hi ${escapeHtml(email)}</h1>
  <h2>Reset Your Password</h2>
  <p>Use the code below to reset your password.</p>

  <div
    style="
      display: inline-block;
      padding: 14px 28px;
      background: #171717;
      color: white;
      text-decoration: none;
      border-radius: 6px;
    "
  >
     otp : ${otp}
  </div>
  <p>This code will expire shortly. If you did not request a password reset, ignore this email.</p>

</body>
</html>
`;

export const forgotPassword = forgotPasswordTemplate;

export const mailService = new MailService();
