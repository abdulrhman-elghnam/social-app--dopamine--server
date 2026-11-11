import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '../exception/main.exception.js';
import { SystemRoleEnum, TokenTypeEnum } from '../value/security.enum.js';
import { cacheService, RedisKeys } from './cache.service.js';
import { configService } from './config.service.js';

export interface LoginCredentialsUser {
  _id: Types.ObjectId | string;
  role: SystemRoleEnum;
}

export class TokenService {
  private readonly accessExpiresIn: number;
  private readonly refreshExpiresIn: number;

  constructor() {
    this.accessExpiresIn = this.readPositiveInteger(
      configService.getOrThrow('ACCESS_USER_TOKEN_EXPIRY'),
      'ACCESS_USER_TOKEN_EXPIRY'
    );
    this.refreshExpiresIn = this.readPositiveInteger(
      configService.getOrThrow('REFRESH_SYSTEM_TOKEN_EXPIRY'),
      'REFRESH_SYSTEM_TOKEN_EXPIRY'
    );
  }

  private readPositiveInteger(value: string, name: string): number {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new Error(`${name} must be a positive integer`);
    }
    return parsed;
  }

  private getSecret(tokenType: TokenTypeEnum): string {
    if (tokenType === TokenTypeEnum.REFRESH) {
      return configService.getOrThrow('REFRESH_SYSTEM_TOKEN_SECRET');
    }
    return configService.getOrThrow('ACCESS_USER_TOKEN_SECRET');
  }

  sign(payload: object, secret: string, options: SignOptions = {}): string {
    return jwt.sign(payload, secret, options);
  }

  private extractBearerToken(value: string): string {
    const match = /^Bearer\s+([^\s]+)$/i.exec(value.trim());
    if (!match?.[1]) {
      throw new UnauthorizedException('Invalid authorization header');
    }
    return match[1];
  }

  verify(token: string, secret: string): JwtPayload {
    try {
      const payload = jwt.verify(this.extractBearerToken(token), secret);
      return typeof payload === 'string' ? (JSON.parse(payload) as JwtPayload) : payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  decode(token: string): JwtPayload {
    const payload = jwt.decode(token);

    if (!payload || typeof payload === 'string') {
      throw new BadRequestException('Invalid token payload');
    }
    return payload;
  }

  async decodeToken(
    token: string,
    expectedType: TokenTypeEnum = TokenTypeEnum.ACCESS
  ): Promise<JwtPayload> {
    const rawToken = this.extractBearerToken(token);
    const claimed = this.decode(rawToken);
    if (!Array.isArray(claimed.aud) || claimed.aud.length !== 2) {
      throw new BadRequestException('Invalid token audience');
    }

    const [claimedType, claimedRole] = claimed.aud;
    if (claimedType !== expectedType) {
      throw new BadRequestException(`Invalid token type. Only ${expectedType} is allowed`);
    }
    if (!Object.values(SystemRoleEnum).includes(claimedRole as SystemRoleEnum)) {
      throw new BadRequestException('Invalid token role');
    }
    if (!claimed.sub || !Types.ObjectId.isValid(claimed.sub)) {
      throw new BadRequestException('Invalid token subject');
    }
    if (!claimed.jti) {
      throw new BadRequestException('Invalid token id');
    }

    const role = claimedRole as SystemRoleEnum;

    const verified = this.verify(token, this.getSecret(expectedType));
    const activeType = await cacheService.getCache<TokenTypeEnum>(
      RedisKeys.userToken(verified.sub ?? '', verified.jti ?? '')
    );
    if (activeType !== expectedType) {
      throw new UnauthorizedException('Invalid login session');
    }
    if (verified['role'] !== undefined && verified['role'] !== role) {
      throw new UnauthorizedException('Invalid login session');
    }

    return verified;
  }

  async createLoginCredentials(
    user: LoginCredentialsUser,
    issuer: string
  ): Promise<{ access_token: string; refresh_token: string }> {
    const subject = user._id.toString();
    const accessJti = randomUUID();
    const refreshJti = randomUUID();
    const accessSecret = this.getSecret(TokenTypeEnum.ACCESS);
    const refreshSecret = this.getSecret(TokenTypeEnum.REFRESH);

    const [accessToken, refreshToken] = await Promise.all([
      Promise.resolve(
        this.sign({ sub: subject }, accessSecret, {
          issuer,
          audience: [TokenTypeEnum.ACCESS, user.role],
          expiresIn: this.accessExpiresIn,
          jwtid: accessJti,
        })
      ),
      Promise.resolve(
        this.sign({ sub: subject }, refreshSecret, {
          issuer,
          audience: [TokenTypeEnum.REFRESH, user.role],
          expiresIn: this.refreshExpiresIn,
          jwtid: refreshJti,
        })
      ),
    ]);

    await Promise.all([
      cacheService.setCache({
        key: RedisKeys.userToken(subject, accessJti),
        value: TokenTypeEnum.ACCESS,
        options: { EX: this.accessExpiresIn },
      }),
      cacheService.setCache({
        key: RedisKeys.userToken(subject, refreshJti),
        value: TokenTypeEnum.REFRESH,
        options: { EX: this.refreshExpiresIn },
      }),
    ]);

    return { access_token: accessToken, refresh_token: refreshToken };
  }

  async logout(userId: Types.ObjectId | string): Promise<number> {
    return cacheService.deleteByPattern(RedisKeys.userTokens(userId.toString()));
  }

  async revokeToken(userId: Types.ObjectId | string, tokenId: string): Promise<number> {
    return cacheService.deleteCache(RedisKeys.userToken(userId.toString(), tokenId));
  }

  async rotateRefreshToken(
    token: string,
    issuer: string
  ): Promise<{ access_token: string; refresh_token: string }> {
    const bearerToken = /^Bearer\s+/i.test(token.trim()) ? token.trim() : `Bearer ${token.trim()}`;
    const decoded = await this.decodeToken(bearerToken, TokenTypeEnum.REFRESH);
    if (!decoded.jti || !decoded.exp || !decoded.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    if (ttl <= 0) throw new UnauthorizedException('Refresh token expired');
    if (ttl > 5 * 60) {
      throw new ConflictException('Refresh token can only be renewed within 5 minutes of expiry');
    }

    const role = Array.isArray(decoded.aud) ? decoded.aud[1] : undefined;
    if (!Object.values(SystemRoleEnum).includes(role as SystemRoleEnum)) {
      throw new UnauthorizedException('Invalid login session');
    }

    const activeToken = await cacheService.getAndDelete(
      RedisKeys.userToken(decoded.sub, decoded.jti)
    );
    if (activeToken !== TokenTypeEnum.REFRESH) {
      throw new UnauthorizedException('Refresh token already used or no longer active');
    }

    return this.createLoginCredentials({ _id: decoded.sub, role: role as SystemRoleEnum }, issuer);
  }
}

export const tokenService = new TokenService();
