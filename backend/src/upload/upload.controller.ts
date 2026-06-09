import {
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { Request } from 'express';

const uploadDir = join(process.cwd(), 'uploads');
mkdirSync(uploadDir, { recursive: true });

const allowedExts = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.gif',
  '.svg', '.heic',
  '.pdf',
  '.txt', '.csv',
  '.doc', '.docx',
  '.xls', '.xlsx',
  '.ppt', '.pptx',
  '.zip',
  '.rar',
]);

@Controller('upload')
export class UploadController {
  constructor(private config: ConfigService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `${uuidv4()}${ext}`);
        },
      }),
      limits: { fileSize: 25 * 1024 * 1024 },
      fileFilter: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, accept: boolean) => void) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!allowedExts.has(ext)) {
          return cb(new BadRequestException('File type not allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  uploadFile(@UploadedFile() file: any, @Req() req: Request) {
    if (!file) throw new BadRequestException('No file provided');
    const forwardedProto = req.headers['x-forwarded-proto'];
    const forwardedHost = req.headers['x-forwarded-host'];
    const requestOrigin =
      forwardedProto && forwardedHost
        ? `${String(forwardedProto).split(',')[0]}://${String(forwardedHost).split(',')[0]}`
        : `${req.protocol}://${req.get('host')}`;
    const apiUrl =
      this.config.get<string>('API_URL') ||
      this.config.get<string>('BACKEND_PUBLIC_URL') ||
      requestOrigin;
    return {
      url: `${apiUrl}/uploads/${file.filename}`,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }
}
