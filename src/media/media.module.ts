import { Module, forwardRef } from '@nestjs/common';
import { MediaController } from './media.controller';
import { UserUploadController } from './controllers/user-upload.controller';
import { AdminTagCategoryController } from './controllers/admin-tag-category.controller';
import { AdminMediaController } from './controllers/admin-media.controller';
import { AdminLogsController } from './controllers/admin-logs.controller';
import { MediaInteractionController } from './controllers/media-interaction.controller';
import { MediaService } from './media.service';
import { MediaInteractionService } from './media-interaction.service';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from 'src/database/database.module';
import { AuthModule } from 'src/auth/auth.module';
import { MyLoggerModule } from 'src/my-logger/my-logger.module';
import { LogsModule } from 'src/logs/logs.module';
import { VideoProcessingModule } from 'src/video-processing/video-processing.module';
import { UploadModule } from 'src/upload/upload.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AuthModule,
    MyLoggerModule,
    LogsModule,
    VideoProcessingModule,
    forwardRef(() => UploadModule),
  ],
  controllers: [MediaController, UserUploadController, AdminTagCategoryController, AdminMediaController, AdminLogsController, MediaInteractionController],
  providers: [MediaService, MediaInteractionService],
  exports: [MediaService, MediaInteractionService],
})
export class MediaModule { }
