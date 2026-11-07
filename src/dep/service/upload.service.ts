import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import type { FileFilterCallback } from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import { BadRequestException } from '../exception/main.exception.js';

export const fileFieldValidation = {
  image: ['image/jpeg', 'image/jpg', 'image/png'],
  video: ['video/mp4'],
} as const;

interface UploadOptions {
  maxFileSize?: number;
  validation?: readonly string[];
  customPath?: string;
}

interface ProcessFileOptions extends UploadOptions {
  file: Express.Multer.File;
}

interface ProcessFilesOptions extends UploadOptions {
  files: Express.Multer.File[];
}

interface ProcessFieldsOptions extends UploadOptions {
  fields: Record<string, Express.Multer.File[]>;
}

const invalidFormatError = () =>
  new BadRequestException('Invalid file format', { messageCode: 603 });

export class UploadService {
  localFileUpload = ({
    maxFileSize = 5,
    validation = [],
    customPath = 'general',
  }: UploadOptions = {}) => {
    const destination = `./assets/${customPath}`;

    const storage = multer.diskStorage({
      destination: async (_req, _file, callback) => {
        try {
          await mkdir(resolve(destination), { recursive: true });
          callback(null, destination);
        } catch (error) {
          callback(error as Error, destination);
        }
      },
      filename: (_req, file, callback) => {
        callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
      },
    });

    const fileFilter = (_req: Request, file: Express.Multer.File, callback: FileFilterCallback) => {
      if (validation.includes(file.mimetype)) {
        callback(null, true);
      } else {
        callback(invalidFormatError());
      }
    };

    return multer({
      fileFilter,
      storage,
      limits: { fileSize: maxFileSize * 1024 * 1024 },
    });
  };

  processFile = async ({ customPath = 'general', file, validation = [] }: ProcessFileOptions) => {
    const buffer = file.buffer ?? (await readFile(resolve(file.path)));
    const result = await fileTypeFromBuffer(buffer);

    if (!result || !validation.includes(result.mime)) {
      throw invalidFormatError();
    }

    if (!file.buffer) {
      file.path = file.path.replace(/\\/g, '/').replace(/^\.\//, '');
      return file;
    }

    await mkdir(resolve(`./assets/${customPath}`), { recursive: true });
    const uniqueFilePath = `assets/${customPath}/${randomUUID()}.${result.ext}`;
    await writeFile(resolve(`./${uniqueFilePath}`), file.buffer);
    file.path = uniqueFilePath;

    return file;
  };

  processFiles = async ({
    customPath = 'general',
    files = [],
    validation = [],
  }: ProcessFilesOptions) => {
    const assets: Express.Multer.File[] = [];

    for (const file of files) {
      assets.push(await this.processFile({ customPath, file, validation }));
    }

    return assets;
  };

  processFields = async ({
    customPath = 'general',
    fields = {},
    validation = [],
  }: ProcessFieldsOptions) => {
    const assets: Array<{ field: string; files: Express.Multer.File[] }> = [];

    for (const [field, files] of Object.entries(fields)) {
      assets.push({
        field,
        files: await this.processFiles({ customPath, files, validation }),
      });
    }

    return assets;
  };

  processMulterUpload = ({ customPath = 'general', validation = [] }: UploadOptions = {}) => {
    return async (req: Request, _res: Response, next: NextFunction) => {
      try {
        if (req.file) {
          await this.processFile({
            customPath,
            file: req.file as Express.Multer.File,
            validation,
          });
        } else if (Array.isArray(req.files)) {
          await this.processFiles({
            customPath,
            files: req.files as Express.Multer.File[],
            validation,
          });
        } else if (req.files && typeof req.files === 'object') {
          await this.processFields({
            customPath,
            fields: req.files as Record<string, Express.Multer.File[]>,
            validation,
          });
        }
        next();
      } catch (error) {
        next(error);
      }
    };
  };
}

export const uploadService = new UploadService();
