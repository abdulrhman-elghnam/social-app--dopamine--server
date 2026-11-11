import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { configService } from './config.service.js';

export class SecurityService {
  private readonly encryptionKey: Buffer;
  private readonly ivLength: number;
  private readonly hashSaltRounds: number;

  constructor() {
    const keyHex = configService.getOrThrow('ENCRYPTION_KEY');
    this.encryptionKey = Buffer.from(keyHex, 'hex');
    if (keyHex.length !== 64 || this.encryptionKey.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be a 64-character hexadecimal AES-256 key');
    }

    this.ivLength = Number(configService.getOrThrow('IV_LENGTH'));
    this.hashSaltRounds = Number(configService.getOrThrow('HASH_SALT'));
  }

  encrypt(text: string): string {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);

    const encryptedText = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]).toString('hex');

    return `${iv.toString('hex')}:${encryptedText}`;
  }

  decrypt(encryptedData: string): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted data format');
    }

    const ivHex = parts[0];
    const encryptedText = parts[1];
    if (
      ivHex === undefined ||
      encryptedText === undefined ||
      ivHex.length !== this.ivLength * 2 ||
      !/^[0-9a-f]+$/i.test(ivHex) ||
      encryptedText.length === 0 ||
      encryptedText.length % 2 !== 0 ||
      !/^[0-9a-f]+$/i.test(encryptedText)
    ) {
      throw new Error('Invalid encrypted data format');
    }

    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, Buffer.from(ivHex, 'hex'));

    return Buffer.concat([decipher.update(encryptedText, 'hex'), decipher.final()]).toString('utf8');
  }

  async hash(plainText: string): Promise<string> {
    const salt = await bcrypt.genSalt(this.hashSaltRounds);
    console.log(this.hashSaltRounds);

    return bcrypt.hash(plainText, salt);
  }

  async compare(plainText: string, hashedText: string): Promise<boolean> {
    return bcrypt.compare(plainText, hashedText);
  }
}

export const securityService = new SecurityService();
