import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { MyLoggerService } from '../../my-logger/my-logger.service';
import { DatabaseService } from '../../database/database.service';
import { FFmpegService, VideoMetadata, VideoQuality } from './ffmpeg.service';
import { HlsService } from './hls.service';
import { ThumbnailService } from './thumbnail.service';
import * as path from 'path';
import * as fs from 'fs-extra';
import {
  getProcessedMediaDir,
  PROCESSED_ROOT,
  LEGACY_PROCESSED_ROOT,
} from '../../common/utils/storage-path.util';

export interface VideoProcessingJob {
  mediaId: string;
  inputPath: string;
  outputDir: string;
  userId: number;
  options?: {
    generateQualities?: string[];
    generateHLS?: boolean;
    generateThumbnails?: boolean;
    skipIfExists?: boolean;
  };
}

export interface VideoProcessingResult {
  mediaId: string;
  success: boolean;
  metadata?: VideoMetadata;
  qualities?: Array<{
    quality: string;
    path: string;
    url: string;
    size: number;
    bitrate: number;
    width: number;
    height: number;
  }>;
  hls?: {
    masterPlaylist: string;
    variants: Array<{
      quality: string;
      playlist: string;
      segmentCount: number;
    }>;
  };
  thumbnails?: {
    cover: string;
    previews: string[];
    sprite?: string;
    spriteVtt?: string;
  };
  error?: string;
  processingTime: number;
  processedSourceUrl?: string;
  originalSourceUrl?: string;
}

export enum ProcessingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/**
 * 视频处理主服务
 * 协调FFmpeg、HLS、缩略图生成等服务，提供完整的视频处理流程
 */
@Injectable()
export class VideoProcessingService {
  private readonly logger = new MyLoggerService(VideoProcessingService.name);

  constructor(
    @InjectQueue('video-processing') private videoQueue: Queue,
    private databaseService: DatabaseService,
    private ffmpegService: FFmpegService,
    private hlsService: HlsService,
    private thumbnailService: ThumbnailService,
  ) {}

  /**
   * 提交视频处理任务
   * @param job 视频处理任务
   * @returns Promise<string> 任务ID
   */
  async submitProcessingJob(job: VideoProcessingJob): Promise<string> {
    try {
      // 验证输入文件是否存在
      const inputExists = await fs.pathExists(job.inputPath);
      if (!inputExists) {
        throw new Error(`输入文件不存在: ${job.inputPath}`);
      }

      // 验证视频文件有效性
      const isValid = await this.ffmpegService.isValidVideo(job.inputPath);
      if (!isValid) {
        throw new Error('输入文件不是有效的视频文件');
      }

      // 更新数据库状态为处理中
      await this.updateProcessingStatus(
        job.mediaId,
        ProcessingStatus.PROCESSING,
      );

      // 提交到队列
      const queueJob = await this.videoQueue.add('process-video', job, {
        priority: 1, // 优先级
        attempts: 3, // 最大重试次数
        removeOnComplete: 10,
        removeOnFail: 50,
      });

      this.logger.log(
        `视频处理任务已提交: ${job.mediaId}, 队列ID: ${queueJob.id}`,
      );
      return queueJob.id?.toString() || 'unknown';
    } catch (error) {
      this.logger.error(`提交处理任务失败: ${error.message}`, error.stack);
      await this.updateProcessingStatus(
        job.mediaId,
        ProcessingStatus.FAILED,
        error.message,
      );
      throw error;
    }
  }

  /**
   * 执行视频处理（由队列处理器调用）
   * @param job 视频处理任务
   * @returns VideoProcessingResult
   */
  async processVideo(job: VideoProcessingJob): Promise<VideoProcessingResult> {
    const startTime = Date.now();

    const result: VideoProcessingResult = {
      mediaId: job.mediaId,
      success: false,
      processingTime: 0,
    };

    try {
      this.logger.log(`开始处理视频: ${job.mediaId}`);

      // 确保输出目录存在
      await fs.ensureDir(job.outputDir);

      const originalAbsolutePath = job.inputPath;
      const originalRelativePath = path
        .relative(process.cwd(), originalAbsolutePath)
        .replace(/\\/g, '/');

      const sourceDir = path.join(job.outputDir, 'source');
      await fs.ensureDir(sourceDir);
      const processedOriginalPath = path.join(sourceDir, 'original.mp4');

      const originalMetadata =
        await this.ffmpegService.getVideoMetadata(originalAbsolutePath);

      const extension = path.extname(originalAbsolutePath).toLowerCase();
      if (extension === '.mov') {
        await this.ffmpegService.convertMovToMp4(
          originalAbsolutePath,
          processedOriginalPath,
          originalMetadata,
        );
      } else {
        await fs.copy(originalAbsolutePath, processedOriginalPath);
      }

      const processedMetadata = await this.ffmpegService.getVideoMetadata(
        processedOriginalPath,
      );

      const processedSourceRelativePath = path
        .relative(process.cwd(), processedOriginalPath)
        .replace(/\\/g, '/');

      result.originalSourceUrl = originalRelativePath;
      result.processedSourceUrl = processedSourceRelativePath;

      const normalizedMetadata: VideoMetadata = {
        ...processedMetadata,
        width:
          processedMetadata.rotation === 90 ||
          processedMetadata.rotation === 270
            ? processedMetadata.height
            : processedMetadata.width,
        height:
          processedMetadata.rotation === 90 ||
          processedMetadata.rotation === 270
            ? processedMetadata.width
            : processedMetadata.height,
      };

      const processingJob: VideoProcessingJob = {
        ...job,
        inputPath: processedOriginalPath,
      };

      // 1. 提取视频元数据
      result.metadata = normalizedMetadata;
      this.logger.log(
        `视频元数据: ${result.metadata.width}x${result.metadata.height}, ${result.metadata.duration}s`,
      );

      // 2. 生成多分辨率版本
      const recommendedQualities = this.ffmpegService.getRecommendedQualities(
        result.metadata,
      );
      let targetQualities = recommendedQualities;

      if (Array.isArray(job.options?.generateQualities)) {
        const requested = job.options.generateQualities;
        if (requested.length === 0) {
          targetQualities = [];
        } else {
          const allowList = requested.map((name) => name.toLowerCase());
          const filtered = recommendedQualities.filter((q) =>
            allowList.includes(q.name.toLowerCase()),
          );
          if (filtered.length > 0) {
            targetQualities = filtered;
          }
        }
      }

      if (targetQualities.length > 0) {
        result.qualities = await this.generateQualities(
          processingJob,
          result.metadata,
          targetQualities,
        );
      } else {
        result.qualities = [];
      }

      // 3. 生成HLS流
      if (job.options?.generateHLS !== false && targetQualities.length > 0) {
        result.hls = await this.generateHLSStream(
          processingJob,
          result.metadata,
          targetQualities,
        );
      }

      // 4. 生成缩略图
      if (job.options?.generateThumbnails !== false) {
        try {
          result.thumbnails = await this.generateThumbnails(
            processingJob,
            result.metadata,
          );
        } catch (thumbnailError) {
          if (
            thumbnailError instanceof Error &&
            thumbnailError.message.includes('视频时长过短')
          ) {
            this.logger.warn(
              `精灵图生成跳过（时长过短）: ${job.mediaId}, ${thumbnailError.message}`,
            );
          } else {
            throw thumbnailError;
          }
        }
      }

      const originalStat = await fs.stat(processedOriginalPath);
      const originalQuality = {
        quality: 'ORIGINAL',
        path: processedOriginalPath,
        url: this.getPublicUrl(processedOriginalPath),
        size: originalStat.size,
        bitrate: result.metadata?.bitrate || originalMetadata.bitrate || 0,
        width: result.metadata?.width || originalMetadata.width || 0,
        height: result.metadata?.height || originalMetadata.height || 0,
      };

      if (!result.qualities) {
        result.qualities = [];
      }
      result.qualities = [...result.qualities, originalQuality];

      // 5. 更新数据库
      await this.updateMediaRecord(job.mediaId, result);
      await this.updateProcessingStatus(
        job.mediaId,
        ProcessingStatus.COMPLETED,
      );

      result.success = true;
      result.processingTime = Date.now() - startTime;

      this.logger.log(
        `视频处理完成: ${job.mediaId}, 耗时: ${result.processingTime}ms`,
      );
      return result;
    } catch (error) {
      result.success = false;
      result.error = error instanceof Error ? error.message : String(error);
      result.processingTime = Date.now() - startTime;

      this.logger.error(
        `视频处理失败: ${job.mediaId}, ${result.error}`,
        error instanceof Error ? error.stack : undefined,
      );

      if (result.metadata) {
        try {
          await this.updateMediaRecord(job.mediaId, result);
        } catch (updateError) {
          this.logger.error(
            `处理失败时写入元数据失败: ${job.mediaId}, ${
              (updateError as Error).message
            }`,
            updateError instanceof Error ? updateError.stack : undefined,
          );
        }
      }

      await this.updateProcessingStatus(
        job.mediaId,
        ProcessingStatus.FAILED,
        result.error,
      );

      throw error;
    }
  }

  /**
   * 生成多分辨率版本
   * @param job 处理任务
   * @param metadata 视频元数据
   * @returns 质量版本信息
   */
  private async generateQualities(
    job: VideoProcessingJob,
    metadata: VideoMetadata,
    targetQualities: VideoQuality[],
  ): Promise<VideoProcessingResult['qualities']> {
    const qualities: VideoProcessingResult['qualities'] = [];
    const qualitiesDir = path.join(job.outputDir, 'qualities');
    await fs.ensureDir(qualitiesDir);

    try {
      this.logger.debug(
        `目标质量: ${targetQualities.map((q) => q.name).join(', ')}`,
      );

      // 为每个质量生成转码版本
      for (const qualityConfig of targetQualities) {
        const outputPath = path.join(qualitiesDir, `${qualityConfig.name}.mp4`);

        this.logger.debug(`开始转码 ${qualityConfig.name} 质量...`);
        await this.ffmpegService.transcodeVideo(
          job.inputPath,
          outputPath,
          qualityConfig,
          { metadata },
        );

        // 获取文件信息
        const stat = await fs.stat(outputPath);

        qualities.push({
          quality: qualityConfig.name,
          path: outputPath,
          url: this.getPublicUrl(outputPath),
          size: stat.size,
          bitrate: parseInt(qualityConfig.bitrate) * 1000, // 转换为bps
          width: qualityConfig.width,
          height: qualityConfig.height,
        });
      }

      this.logger.log(`生成 ${qualities.length} 个质量版本`);
      return qualities;
    } catch (error) {
      this.logger.error(`生成多分辨率版本失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 生成HLS流
   * @param job 处理任务
   * @param metadata 视频元数据
   * @returns HLS信息
   */
  private async generateHLSStream(
    job: VideoProcessingJob,
    metadata: VideoMetadata,
    targetQualities: VideoQuality[],
  ): Promise<VideoProcessingResult['hls']> {
    const hlsDir = path.join(job.outputDir, 'hls');

    try {
      const targetQualityNames = targetQualities.map((q) => q.name);
      this.logger.debug(
        `生成HLS流质量: ${targetQualityNames.join(', ')}, 源尺寸: ${metadata.width}x${metadata.height}`,
      );

      const hlsResult = await this.hlsService.generateAdaptiveHLS(
        job.inputPath,
        hlsDir,
        {
          segmentDuration: 10,
          targetQualities: targetQualityNames,
          enableEncryption: false,
          metadata,
          qualityConfigs: targetQualities,
        },
      );

      // 验证HLS流
      const validation = await this.hlsService.validateHLS(
        hlsResult.masterPlaylist,
      );
      if (!validation.isValid) {
        this.logger.warn(`HLS流验证发现问题: ${validation.issues.join(', ')}`);
      }

      return {
        masterPlaylist: this.getPublicUrl(hlsResult.masterPlaylist),
        variants: hlsResult.qualities.map((variant) => ({
          quality: variant.quality.name,
          playlist: this.getPublicUrl(variant.playlistPath),
          segmentCount: variant.segmentCount,
        })),
      };
    } catch (error) {
      this.logger.error(`生成HLS流失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 生成缩略图
   * @param job 处理任务
   * @param metadata 视频元数据
   * @returns 缩略图信息
   */
  private async generateThumbnails(
    job: VideoProcessingJob,
    metadata: VideoMetadata,
  ): Promise<VideoProcessingResult['thumbnails']> {
    const thumbsDir = path.join(job.outputDir, 'thumbnails');

    try {
      // 1. 生成封面图 - 保持原始比例
      const coverPath = path.join(thumbsDir, 'cover.jpg');

      // 根据原始视频比例计算封面尺寸
      const originalAspectRatio = metadata.width / metadata.height;
      const isVertical = metadata.height > metadata.width;

      let coverWidth: number, coverHeight: number;
      if (isVertical) {
        // 竖屏视频：限制宽度为480，按比例计算高度
        coverWidth = Math.min(480, metadata.width);
        coverHeight = Math.round(coverWidth / originalAspectRatio);
        // 限制最大高度
        if (coverHeight > 800) {
          coverHeight = 800;
          coverWidth = Math.round(coverHeight * originalAspectRatio);
        }
      } else {
        // 横屏视频：限制高度为720，按比例计算宽度
        coverHeight = Math.min(720, metadata.height);
        coverWidth = Math.round(coverHeight * originalAspectRatio);
        // 限制最大宽度
        if (coverWidth > 1280) {
          coverWidth = 1280;
          coverHeight = Math.round(coverWidth / originalAspectRatio);
        }
      }

      this.logger.debug(
        `封面尺寸: ${metadata.width}×${metadata.height} -> ${coverWidth}×${coverHeight}, 竖屏: ${isVertical}`,
      );

      const coverImage = await this.thumbnailService.generateCoverImage(
        job.inputPath,
        coverPath,
        {
          timeOffset: Math.min(10, metadata.duration * 0.1),
          width: coverWidth,
          height: coverHeight,
        },
      );
      const coverPublicUrl = this.getPublicUrl(coverImage);

      // 2. 生成预览缩略图 - 保持原始比例
      let previewWidth: number, previewHeight: number;
      if (isVertical) {
        // 竖屏视频：限制宽度为160，按比例计算高度
        previewWidth = 160;
        previewHeight = Math.round(previewWidth / originalAspectRatio);
        if (previewHeight > 240) {
          previewHeight = 240;
          previewWidth = Math.round(previewHeight * originalAspectRatio);
        }
      } else {
        // 横屏视频：限制高度为180，按比例计算宽度
        previewHeight = 180;
        previewWidth = Math.round(previewHeight * originalAspectRatio);
        if (previewWidth > 320) {
          previewWidth = 320;
          previewHeight = Math.round(previewWidth / originalAspectRatio);
        }
      }

      const previewResult =
        await this.thumbnailService.generatePreviewThumbnails(
          job.inputPath,
          thumbsDir,
          {
            count: Math.min(10, Math.floor(metadata.duration / 10)),
            width: previewWidth,
            height: previewHeight,
            startOffset: 5,
          },
        );

      // 3. 生成精灵图用于视频预览 - 保持原始比例
      let spriteWidth: number, spriteHeight: number;
      if (isVertical) {
        // 竖屏视频：限制宽度为120，按比例计算高度
        spriteWidth = 120;
        spriteHeight = Math.round(spriteWidth / originalAspectRatio);
        if (spriteHeight > 160) {
          spriteHeight = 160;
          spriteWidth = Math.round(spriteHeight * originalAspectRatio);
        }
      } else {
        // 横屏视频：限制高度为90，按比例计算宽度
        spriteHeight = 90;
        spriteWidth = Math.round(spriteHeight * originalAspectRatio);
        if (spriteWidth > 160) {
          spriteWidth = 160;
          spriteHeight = Math.round(spriteWidth / originalAspectRatio);
        }
      }

      const previewPublicUrls = previewResult.thumbnails.map((thumb) =>
        this.getPublicUrl(thumb),
      );

      try {
        const spriteResult =
          await this.thumbnailService.generateThumbnailSprite(
            job.inputPath,
            thumbsDir,
            {
              interval: 10,
              thumbWidth: spriteWidth,
              thumbHeight: spriteHeight,
              columns: 10,
            },
          );

        return {
          cover: coverPublicUrl,
          previews: previewPublicUrls,
          sprite: this.getPublicUrl(spriteResult.spriteImage),
          spriteVtt: this.getPublicUrl(spriteResult.vttFile),
        };
      } catch (spriteError) {
        if (
          spriteError instanceof Error &&
          spriteError.message.includes('视频时长过短')
        ) {
          this.logger.warn(
            `精灵图跳过（时长过短）: ${job.mediaId}, ${spriteError.message}`,
          );
          return {
            cover: coverPublicUrl,
            previews: previewPublicUrls,
          };
        }
        throw spriteError;
      }
    } catch (error) {
      this.logger.error(`生成缩略图失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 更新数据库中的媒体记录
   * @param mediaId 媒体ID
   * @param result 处理结果
   */
  private async updateMediaRecord(
    mediaId: string,
    result: VideoProcessingResult,
  ): Promise<void> {
    try {
      const existingMedia = await this.databaseService.media.findUnique({
        where: { id: mediaId },
        select: {
          url: true,
          source_metadata: true,
        },
      });

      const mergedSourceMetadata: Prisma.JsonObject = {
        ...((existingMedia?.source_metadata as Prisma.JsonObject) ?? {}),
      };

      if (result.originalSourceUrl) {
        mergedSourceMetadata.original_file_url = result.originalSourceUrl;
      }

      const updateData: Prisma.MediaUpdateInput = {
        duration: result.metadata?.duration
          ? Math.round(result.metadata.duration)
          : undefined,
        width: result.metadata?.width,
        height: result.metadata?.height,
        thumbnail_url: result.thumbnails?.cover,
        updated_at: new Date(),
      };

      if (result.processedSourceUrl) {
        updateData.url = result.processedSourceUrl;
      }

      if (Object.keys(mergedSourceMetadata).length > 0) {
        updateData.source_metadata = mergedSourceMetadata;
      }

      await this.databaseService.media.update({
        where: { id: mediaId },
        data: updateData,
      });

      // 插入质量版本记录
      if (result.qualities && result.qualities.length > 0) {
        // 获取可用的质量配置来获取实际的宽高
        for (const quality of result.qualities) {
          const actualWidth = quality.width || result.metadata?.width || 0;
          const actualHeight = quality.height || result.metadata?.height || 0;

          await this.databaseService.videoQuality.create({
            data: {
              media_id: mediaId,
              quality: quality.quality,
              url: quality.url,
              size: quality.size,
              width: actualWidth,
              height: actualHeight,
              bitrate: quality.bitrate,
            },
          });
        }
      }

      this.logger.log(`数据库记录更新完成: ${mediaId}`);
    } catch (error) {
      this.logger.error(`更新数据库记录失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 更新处理状态
   * @param mediaId 媒体ID
   * @param status 状态
   * @param error 错误信息
   */
  private async updateProcessingStatus(
    mediaId: string,
    status: ProcessingStatus,
    error?: string,
  ): Promise<void> {
    try {
      await this.databaseService.media.update({
        where: { id: mediaId },
        data: {
          // 这里可以添加处理状态字段到数据库schema
          updated_at: new Date(),
        },
      });
    } catch (dbError) {
      this.logger.error(`更新处理状态失败: ${dbError.message}`, dbError.stack);
    }
  }

  /**
   * 获取任务状态
   * @param jobId 任务ID
   * @returns 任务状态信息
   */
  async getJobStatus(jobId: string): Promise<any> {
    try {
      const job = await this.videoQueue.getJob(jobId);
      if (!job) {
        return { status: 'not_found' };
      }

      const state = await job.getState();
      const progress = job.progress;

      return {
        id: job.id,
        status: state,
        progress,
        data: job.data,
        result: job.returnvalue,
        error: job.failedReason,
        createdAt: new Date(job.timestamp),
        processedAt: job.processedOn ? new Date(job.processedOn) : null,
        finishedAt: job.finishedOn ? new Date(job.finishedOn) : null,
      };
    } catch (error) {
      this.logger.error(`获取任务状态失败: ${error.message}`, error.stack);
      return { status: 'error', error: error.message };
    }
  }

  /**
   * 取消处理任务
   * @param jobId 任务ID
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.videoQueue.getJob(jobId);
      if (!job) {
        return false;
      }

      await job.remove();
      this.logger.log(`任务已取消: ${jobId}`);
      return true;
    } catch (error) {
      this.logger.error(`取消任务失败: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * 清理处理文件
   * @param mediaId 媒体ID
   */
  async cleanupProcessingFiles(mediaId: string): Promise<void> {
    try {
      this.logger.log(`🗑️ 开始清理视频处理文件: ${mediaId}`);

      // 构建处理文件目录路径
      const processedDir = getProcessedMediaDir(mediaId);

      this.logger.debug(`检查处理目录: ${processedDir}`);

      if (await fs.pathExists(processedDir)) {
        // 递归删除整个处理目录
        await fs.remove(processedDir);
        this.logger.log(`✅ 处理文件目录删除成功: ${processedDir}`);
      } else {
        this.logger.debug(`⚠️ 处理目录不存在: ${processedDir}`);
      }

      // 额外检查和清理可能的其他位置
      const alternativePaths = [
        path.join(LEGACY_PROCESSED_ROOT, mediaId),
        path.join(process.cwd(), 'public', 'processed', mediaId),
      ];

      for (const altPath of alternativePaths) {
        if (await fs.pathExists(altPath)) {
          await fs.remove(altPath);
          this.logger.log(`✅ 清理备选路径成功: ${altPath}`);
        }
      }
    } catch (error) {
      this.logger.error(
        `❌ 清理处理文件失败: ${mediaId}, ${error.message}`,
        error.stack,
      );
      throw error; // 重新抛出错误以便上层处理
    }
  }

  /**
   * 获取文件的公共访问URL
   * @param filePath 文件路径
   * @returns 公共URL
   */
  private getPublicUrl(filePath: string): string {
    const relativePath = path
      .relative(process.cwd(), filePath)
      .replace(/\\/g, '/');

    if (relativePath.startsWith('processed/')) {
      return `/${relativePath}`;
    }

    if (relativePath.startsWith('uploads/')) {
      const uploadPath = relativePath.replace('uploads/', '');
      return `/api/upload/file/${uploadPath}`;
    }

    return `/${relativePath}`;
  }
}
