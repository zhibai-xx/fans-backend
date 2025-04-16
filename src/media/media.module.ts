import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from 'src/database/database.module';
import { LocalStorageService } from './services/local-storage.service';
import { OssStorageService } from './services/oss-storage.service';
import { StorageFactoryService } from './services/storage-factory.service';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { FileController } from './controllers/file.controller';

@Module({
  imports: [
    ConfigModule, 
    DatabaseModule,
    // 提供静态文件访问功能（仅在本地存储模式下使用）
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'uploads'),
      serveRoot: '/api/media/file',
    }),
  ],
  controllers: [MediaController, FileController],
  providers: [
    MediaService,
    LocalStorageService,
    OssStorageService,
    StorageFactoryService
  ]
})
export class MediaModule {}
