import { JwtPayload } from 'jsonwebtoken';
import { SystemRoleEnum } from '../value/security.enum.js';

declare global {
  namespace Express {
    interface Request {
      validated?: {
        body: unknown;
        params: unknown;
        query: unknown;
        file: unknown;
        files: unknown;
      };
      user?: {
        role: SystemRoleEnum;
      };
      payload?: JwtPayload;
    }
  }
}
