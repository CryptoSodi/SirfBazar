import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = join(process.cwd(), 'storage', 'uploads');

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  /**
   * Image upload for any authenticated user (used during merchant onboarding for
   * the shop-front photo). Saved under storage/uploads and served at /static/uploads.
   */
  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 6 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => cb(null, !!file.mimetype && file.mimetype.startsWith('image/')),
    }),
  )
  uploadImage(@UploadedFile() file: any) {
    if (!file || !file.buffer) throw new BadRequestException('No image uploaded');
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed');
    }
    const ext = (file.originalname?.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const filename = `${randomUUID()}.${ext}`;
    mkdirSync(UPLOAD_DIR, { recursive: true });
    writeFileSync(join(UPLOAD_DIR, filename), file.buffer);
    const base = process.env.PUBLIC_BASE_URL || 'https://api.sirfbazar.com';
    return { url: `${base}/static/uploads/${filename}` };
  }
}
