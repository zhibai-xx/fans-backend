import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MediaController } from './media.controller';
import { UserUploadController } from './controllers/user-upload.controller';
import { AdminTagCategoryController } from './controllers/admin-tag-category.controller';
import { AdminMediaController } from './controllers/admin-media.controller';
import { AdminLogsController } from './controllers/admin-logs.controller';
import { MediaInteractionController } from './controllers/media-interaction.controller';
import { MediaCommentController } from './controllers/media-comment.controller';
import { MediaDownloadController } from './controllers/media-download.controller';
import { UserDownloadController } from './controllers/user-download.controller';
import { MediaService } from './media.service';
import { MediaInteractionService } from './media-interaction.service';
import { MediaCommentService } from './services/media-comment.service';
import { DownloadRecordService } from './services/download-record.service';
import { MediaViewTrackerService } from './services/media-view-tracker.service';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from 'src/database/database.module';
import { AuthModule } from 'src/auth/auth.module';
import { MyLoggerModule } from 'src/my-logger/my-logger.module';
import { LogsModule } from 'src/logs/logs.module';
import { VideoProcessingModule } from 'src/video-processing/video-processing.module';
import { UploadModule } from 'src/upload/upload.module';
import { EnhancedDeletionService } from './services/enhanced-deletion.service';
import { MediaCleanupScheduler } from './services/media-cleanup.scheduler';
import { MediaCleanupProcessor } from './processors/media-cleanup.processor';
import { MediaViewController } from './controllers/media-view/media-view.controller';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AuthModule,
    MyLoggerModule,
    LogsModule,
    VideoProcessingModule,
    forwardRef(() => UploadModule),
    BullModule.registerQueue({
      name: 'media-cleanup',
    }),
  ],
  controllers: [
    MediaController,
    UserUploadController,
    AdminTagCategoryController,
    AdminMediaController,
    AdminLogsController,
    MediaInteractionController,
    MediaCommentController,
    MediaViewController,
    MediaDownloadController,
    UserDownloadController,
  ],
  providers: [
    MediaService,
    MediaInteractionService,
    MediaCommentService,
    DownloadRecordService,
    MediaViewTrackerService,
    EnhancedDeletionService,
    MediaCleanupScheduler,
    MediaCleanupProcessor,
  ],
  exports: [MediaService, MediaInteractionService, EnhancedDeletionService],
})
export class MediaModule {}
