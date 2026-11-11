import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { BadRequestException } from '../exception/main.exception.js';
import { uploadService } from '../service/upload.service.js';

interface UploadMiddlewareOptions {
  multerMiddleware: RequestHandler;
  customPath?: string;
  validation?: readonly string[];
  isRequired?: boolean;
}

export class UploadPipe {
  uploadMiddleware = ({
    multerMiddleware,
    customPath = 'general',
    validation = [],
    isRequired = true,
  }: UploadMiddlewareOptions): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction) => {
      multerMiddleware(req, res, async (error?: unknown) => {
        if (error) {
          const uploadError = error as Error & { status?: number };
          return next(
            new BadRequestException(uploadError.message || 'Invalid upload', {
              extra: uploadError,
            })
          );
        }

        const hasUploadedFile = Boolean(req.file || req.files);
        if (isRequired && !hasUploadedFile) {
          return next(new BadRequestException('File is required', { messageCode: 602 }));
        }

        try {
          const processUpload = uploadService.processMulterUpload({
            customPath,
            validation,
          });
          await processUpload(req, res, next);
        } catch (error) {
          next(error);
        }
      });
    };
  };
}

export const uploadPipe = new UploadPipe();
