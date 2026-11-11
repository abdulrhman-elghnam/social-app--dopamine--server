import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import { BadRequestException } from '../exception/main.exception.js';
import { configService } from './config.service.js';

export interface GoogleAccount {
  googleId: string;
  name: string | undefined;
  email: string;
  picture: string | undefined;
}

export class GoogleService {
  private readonly client: OAuth2Client;
  private readonly clientId: string;

  constructor() {
    this.client = new OAuth2Client();
    this.clientId = configService.getOrThrow('OAUTH_GOOGLE_CLIENT_ID');
  }

  async verifyGoogleAccount(idToken: string): Promise<GoogleAccount> {
    let payload: TokenPayload | undefined;
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.clientId,
      });
      payload = ticket.getPayload();
    } catch (error) {
      throw new BadRequestException('Invalid Google account token', {
        messageCode: 301,
        extra: error,
      });
    }

    if (!payload?.email_verified || !payload.email || !payload.sub) {
      throw new BadRequestException('Invalid Google account data', {
        messageCode: 301,
      });
    }
    return {
      googleId: payload.sub,
      name: payload.name,
      email: payload.email.toLowerCase(),
      picture: payload.picture,
    };
  }
}

export const googleService = new GoogleService();
