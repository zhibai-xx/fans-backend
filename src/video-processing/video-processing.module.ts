import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { VideoProcessingService } from './services/video-processing.service';
import { VideoProcessingController } from './controllers/video-processing.controller';
import { VideoProcessor } from './processors/video.processor';
import { FFmpegService } from './services/ffmpeg.service';
import { ThumbnailService } from './services/thumbnail.service';
import { HlsService } from './services/hls.service';
import { DatabaseModule } from '../database/database.module';
import { MyLoggerModule } from '../my-logger/my-logger.module';

/**
 * 视频处理模块
 * 提供现代化的视频处理功能：
 * - 异步视频转码
 * - 多分辨率生成
 * - HLS切片
 * - 缩略图生成
 * - 进度追踪
 */
@Global()
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    MyLoggerModule,
    // 配置BullMQ队列用于异步视频处理
    BullModule.forRootAsync({
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get('REDIS_DB', 0),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'video-processing',
      defaultJobOptions: {
        attempts: 3, // 最大重试次数
        backoff: {
          type: 'exponential',
          delay: 2000, // 指数退避延迟
        },
        removeOnComplete: 10, // 保留最近10个完成的任务
        removeOnFail: 50, // 保留最近50个失败的任务
      },
    }),
  ],
  controllers: [VideoProcessingController],
  providers: [
    VideoProcessingService,
    VideoProcessor,
    FFmpegService,
    ThumbnailService,
    HlsService,
  ],
  exports: [VideoProcessingService, ThumbnailService],
})
export class VideoProcessingModule { }
