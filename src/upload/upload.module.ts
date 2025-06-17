import { Module } from '@nestjs/common';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { FileController } from './controllers/file.controller';
import { LocalStorageService } from './services/local-storage.service';
import { OssStorageService } from './services/oss-storage.service';
import { StorageFactoryService } from './services/storage-factory.service';
import { DatabaseModule } from '../database/database.module';
import { MediaModule } from '../media/media.module';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Module({
  imports: [
    DatabaseModule,
    MediaModule,
    ConfigModule,
    MulterModule.register({
      storage: diskStorage({
        destination: './uploads/temp',
        filename: (req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
          const ext = path.extname(file.originalname);
          cb(null, `${uniqueSuffix}${ext}`);
        },
      }),
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB 文件大小限制
        files: 1, // 单次只允许上传一个文件
      },
    }),
  ],
  controllers: [UploadController, FileController],
  providers: [
    UploadService,
    LocalStorageService,
    OssStorageService,
    StorageFactoryService,
  ],
  exports: [
    UploadService,
    LocalStorageService,
    OssStorageService,
    StorageFactoryService,
  ],
})
export class UploadModule { }
