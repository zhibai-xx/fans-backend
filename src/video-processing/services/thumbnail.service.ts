import { Injectable, Logger } from '@nestjs/common';
import { FFmpegService } from './ffmpeg.service';
import * as path from 'path';
import * as fs from 'fs-extra';

/**
 * 缩略图服务 - 使用现代FFmpeg CLI实现缩略图生成
 *
 * 功能包括：
 * - 视频封面图生成
 * - 多时间点缩略图
 * - 精灵图(Sprite)生成
 * - VTT字幕文件生成
 * - 预览缩略图管理
 */
@Injectable()
export class ThumbnailService {
  private readonly logger = new Logger(ThumbnailService.name);

  constructor(private readonly ffmpegService: FFmpegService) {}

  /**
   * 快速生成视频封面图 (优化用户体验)
   * 在视频上传完成后立即生成，提供更快的封面预览
   * @param videoPath 视频文件路径
   * @param outputPath 封面图输出路径
   * @returns Promise<string> 封面图路径
   */
  async generateQuickCover(
    videoPath: string,
    outputPath: string,
  ): Promise<string> {
    this.logger.log(`⚡ 快速生成视频封面: ${path.basename(videoPath)}`);

    try {
      // 确保输出目录存在
      await fs.ensureDir(path.dirname(outputPath));

      // 获取视频元数据，选择合适的截取时间点
      const metadata = await this.ffmpegService.getVideoMetadata(videoPath);
      const timeOffset = Math.min(5, Math.floor(metadata.duration / 4)); // 取1/4处或5秒

      // 根据视频原始尺寸智能选择目标尺寸
      const { width: originalWidth, height: originalHeight } = metadata;
      const isVertical = originalHeight > originalWidth; // 竖屏视频
      const aspectRatio = originalWidth / originalHeight;

      let targetWidth: number, targetHeight: number;

      if (isVertical) {
        // 竖屏视频：固定宽度为480，高度按比例计算
        targetWidth = 480;
        targetHeight = Math.round(targetWidth / aspectRatio);
        // 限制最大高度
        if (targetHeight > 800) {
          targetHeight = 800;
          targetWidth = Math.round(targetHeight * aspectRatio);
        }
      } else {
        // 横屏视频：固定高度为360，宽度按比例计算
        targetHeight = 360;
        targetWidth = Math.round(targetHeight * aspectRatio);
        // 限制最大宽度
        if (targetWidth > 640) {
          targetWidth = 640;
          targetHeight = Math.round(targetWidth / aspectRatio);
        }
      }

      this.logger.debug(
        `原始尺寸: ${originalWidth}×${originalHeight}, 目标尺寸: ${targetWidth}×${targetHeight}, 竖屏: ${isVertical}`,
      );

      // 快速生成封面，使用智能尺寸
      const command = [
        '-i',
        videoPath,
        '-ss',
        timeOffset.toString(),
        '-frames:v',
        '1',
        '-vf',
        `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:black`,
        '-q:v',
        '75', // 中等质量，平衡文件大小和质量
        '-y', // 覆盖已存在文件
        outputPath,
      ];

      await this.ffmpegService.executeFFmpeg(command);

      this.logger.log(`✅ 快速封面生成完成: ${outputPath}`);
      return outputPath;
    } catch (error) {
      this.logger.error(`❌ 快速封面生成失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 生成视频封面图 (完整版本)
   * @param videoPath 视频文件路径
   * @param outputPath 封面图输出路径
   * @param options 封面图选项
   * @returns Promise<string> 封面图路径
   */
  async generateCoverImage(
    videoPath: string,
    outputPath: string,
    options: {
      timeOffset?: number;
      width?: number;
      height?: number;
      quality?: number;
    } = {},
  ): Promise<string> {
    const {
      timeOffset = 10, // 默认从第10秒截取
      width = 1280,
      height = 720,
      quality = 85,
    } = options;

    this.logger.log(`生成视频封面图: ${videoPath} -> ${outputPath}`);

    try {
      // 获取视频时长，确保时间偏移不超过视频长度
      const metadata = await this.ffmpegService.getVideoMetadata(videoPath);
      const actualTimeOffset = Math.min(
        timeOffset,
        Math.max(1, metadata.duration * 0.1),
      );

      // 生成单张缩略图作为封面
      const thumbnails = await this.ffmpegService.generateThumbnails(
        videoPath,
        outputPath,
        {
          count: 1,
          width,
          height,
          timeOffset: actualTimeOffset,
        },
      );

      if (thumbnails.length === 0) {
        throw new Error('封面图生成失败');
      }

      this.logger.log(`视频封面图生成完成: ${thumbnails[0]}`);
      return thumbnails[0];
    } catch (error) {
      this.logger.error(`生成视频封面图失败: ${error.message}`, error.stack);
      throw new Error(`生成视频封面图失败: ${error.message}`);
    }
  }

  /**
   * 生成视频预览缩略图集
   * @param videoPath 视频文件路径
   * @param outputDir 输出目录
   * @param options 缩略图选项
   * @returns Promise<{thumbnails: string[], count: number, interval: number}>
   */
  async generatePreviewThumbnails(
    videoPath: string,
    outputDir: string,
    options: {
      count?: number;
      interval?: number;
      width?: number;
      height?: number;
      startOffset?: number;
    } = {},
  ): Promise<{ thumbnails: string[]; count: number; interval: number }> {
    const {
      count = 10,
      interval = 0, // 如果为0则自动计算间隔
      width = 320,
      height = 180,
      startOffset = 5,
    } = options;

    this.logger.log(
      `生成视频预览缩略图集: ${videoPath} -> ${outputDir} (${count}张)`,
    );

    try {
      // 获取视频元数据
      const metadata = await this.ffmpegService.getVideoMetadata(videoPath);

      // 计算时间间隔
      const actualInterval =
        interval > 0
          ? interval
          : Math.max(1, (metadata.duration - startOffset) / count);
      const actualCount =
        interval > 0
          ? count
          : Math.min(
              count,
              Math.floor((metadata.duration - startOffset) / actualInterval),
            );

      // 确保输出目录存在
      await fs.ensureDir(outputDir);

      // 生成缩略图文件名模板
      const outputTemplate = path.join(outputDir, 'preview_%03d.jpg');

      // 生成多张缩略图
      const thumbnails = await this.ffmpegService.generateThumbnails(
        videoPath,
        outputTemplate,
        {
          count: actualCount,
          width,
          height,
          timeOffset: startOffset,
          interval: actualInterval,
        },
      );

      this.logger.log(`视频预览缩略图集生成完成: ${thumbnails.length}张`);
      return {
        thumbnails,
        count: thumbnails.length,
        interval: actualInterval,
      };
    } catch (error) {
      this.logger.error(
        `生成视频预览缩略图集失败: ${error.message}`,
        error.stack,
      );
      throw new Error(`生成视频预览缩略图集失败: ${error.message}`);
    }
  }

  /**
   * 生成视频预览精灵图和VTT文件
   * @param videoPath 视频文件路径
   * @param outputDir 输出目录
   * @param options 精灵图选项
   * @returns Promise<{spriteImage: string, vttFile: string, thumbnailInfo: any}>
   */
  async generateThumbnailSprite(
    videoPath: string,
    outputDir: string,
    options: {
      interval?: number;
      thumbWidth?: number;
      thumbHeight?: number;
      columns?: number;
      maxThumbnails?: number;
      quality?: number;
    } = {},
  ): Promise<{
    spriteImage: string;
    vttFile: string;
    thumbnailInfo: {
      count: number;
      interval: number;
      spriteWidth: number;
      spriteHeight: number;
      thumbWidth: number;
      thumbHeight: number;
      columns: number;
      rows: number;
    };
  }> {
    const {
      interval = 10,
      thumbWidth = 160,
      thumbHeight = 90,
      columns = 10,
      maxThumbnails = 100,
      quality = 80,
    } = options;

    this.logger.log(`生成视频预览精灵图: ${videoPath} -> ${outputDir}`);

    try {
      // 确保输出目录存在
      await fs.ensureDir(outputDir);

      // 输出文件路径
      const spriteImage = path.join(outputDir, 'thumbnails-sprite.jpg');
      const vttFile = path.join(outputDir, 'thumbnails.vtt');

      // 使用FFmpegService生成精灵图
      const result = await this.ffmpegService.generateSpriteImage(
        videoPath,
        spriteImage,
        {
          interval,
          thumbWidth,
          thumbHeight,
          columns,
        },
      );

      // 计算精灵图信息
      const thumbnailCount = result.thumbnails.length;
      const rows = Math.ceil(thumbnailCount / columns);
      const spriteWidth = columns * thumbWidth;
      const spriteHeight = rows * thumbHeight;

      const thumbnailInfo = {
        count: thumbnailCount,
        interval,
        spriteWidth,
        spriteHeight,
        thumbWidth,
        thumbHeight,
        columns,
        rows,
      };

      this.logger.log(
        `视频预览精灵图生成完成: ${spriteImage} (${thumbnailCount}张缩略图, ${spriteWidth}x${spriteHeight})`,
      );

      return {
        spriteImage: result.imagePath,
        vttFile: result.vttPath,
        thumbnailInfo,
      };
    } catch (error) {
      this.logger.error(
        `生成视频预览精灵图失败: ${error.message}`,
        error.stack,
      );
      throw new Error(`生成视频预览精灵图失败: ${error.message}`);
    }
  }

  /**
   * 生成关键帧缩略图
   * @param videoPath 视频文件路径
   * @param outputDir 输出目录
   * @param options 关键帧选项
   * @returns Promise<{keyFrames: string[], timestamps: number[]}>
   */
  async generateKeyFrameThumbnails(
    videoPath: string,
    outputDir: string,
    options: {
      maxKeyFrames?: number;
      width?: number;
      height?: number;
      minInterval?: number;
    } = {},
  ): Promise<{ keyFrames: string[]; timestamps: number[] }> {
    const {
      maxKeyFrames = 20,
      width = 320,
      height = 180,
      minInterval = 30, // 最小间隔30秒
    } = options;

    this.logger.log(`生成关键帧缩略图: ${videoPath} -> ${outputDir}`);

    try {
      // 获取视频元数据
      const metadata = await this.ffmpegService.getVideoMetadata(videoPath);

      // 计算关键帧时间点
      const timestamps = this.calculateKeyFrameTimestamps(
        metadata.duration,
        maxKeyFrames,
        minInterval,
      );

      // 确保输出目录存在
      await fs.ensureDir(outputDir);

      const keyFrames: string[] = [];

      // 为每个时间点生成缩略图
      for (let i = 0; i < timestamps.length; i++) {
        const timestamp = timestamps[i];
        const outputPath = path.join(
          outputDir,
          `keyframe_${i.toString().padStart(3, '0')}.jpg`,
        );

        const thumbnails = await this.ffmpegService.generateThumbnails(
          videoPath,
          outputPath,
          {
            count: 1,
            width,
            height,
            timeOffset: timestamp,
          },
        );

        if (thumbnails.length > 0) {
          keyFrames.push(thumbnails[0]);
        }
      }

      this.logger.log(`关键帧缩略图生成完成: ${keyFrames.length}张`);
      return { keyFrames, timestamps };
    } catch (error) {
      this.logger.error(`生成关键帧缩略图失败: ${error.message}`, error.stack);
      throw new Error(`生成关键帧缩略图失败: ${error.message}`);
    }
  }

  /**
   * 批量生成缩略图
   * @param requests 缩略图请求列表
   * @returns Promise<Array<{success: boolean, result?: any, error?: string}>>
   */
  async generateBatchThumbnails(
    requests: Array<{
      videoPath: string;
      outputPath: string;
      type: 'cover' | 'preview' | 'sprite' | 'keyframe';
      options?: any;
    }>,
  ): Promise<Array<{ success: boolean; result?: any; error?: string }>> {
    this.logger.log(`批量生成缩略图: ${requests.length} 个请求`);

    const results: Array<{ success: boolean; result?: any; error?: string }> =
      [];

    for (const request of requests) {
      try {
        let result: any;

        switch (request.type) {
          case 'cover':
            result = await this.generateCoverImage(
              request.videoPath,
              request.outputPath,
              request.options,
            );
            break;

          case 'preview':
            result = await this.generatePreviewThumbnails(
              request.videoPath,
              path.dirname(request.outputPath),
              request.options,
            );
            break;

          case 'sprite':
            result = await this.generateThumbnailSprite(
              request.videoPath,
              path.dirname(request.outputPath),
              request.options,
            );
            break;

          case 'keyframe':
            result = await this.generateKeyFrameThumbnails(
              request.videoPath,
              path.dirname(request.outputPath),
              request.options,
            );
            break;

          default:
            throw new Error(`未知的缩略图类型: ${request.type}`);
        }

        results.push({ success: true, result });
      } catch (error) {
        this.logger.error(
          `批量生成缩略图失败 - ${request.type}: ${error.message}`,
        );
        results.push({ success: false, error: error.message });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    this.logger.log(
      `批量生成缩略图完成: ${successCount}/${requests.length} 成功`,
    );

    return results;
  }

  /**
   * 清理缩略图文件
   * @param outputDir 输出目录
   * @param olderThanDays 清理多少天前的文件
   * @returns Promise<{deletedFiles: number, freedSpace: number}>
   */
  async cleanupThumbnails(
    outputDir: string,
    olderThanDays: number = 7,
  ): Promise<{ deletedFiles: number; freedSpace: number }> {
    this.logger.log(`清理缩略图文件: ${outputDir} (${olderThanDays}天前)`);

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      let deletedFiles = 0;
      let freedSpace = 0;

      const cleanupDir = async (dirPath: string) => {
        if (!(await fs.pathExists(dirPath))) return;

        const items = await fs.readdir(dirPath);

        for (const item of items) {
          const itemPath = path.join(dirPath, item);
          const stat = await fs.stat(itemPath);

          if (stat.isFile()) {
            if (stat.mtime < cutoffDate) {
              freedSpace += stat.size;
              await fs.remove(itemPath);
              deletedFiles++;
            }
          } else if (stat.isDirectory()) {
            await cleanupDir(itemPath);

            // 如果目录为空，删除目录
            const remainingItems = await fs.readdir(itemPath);
            if (remainingItems.length === 0) {
              await fs.remove(itemPath);
            }
          }
        }
      };

      await cleanupDir(outputDir);

      this.logger.log(
        `缩略图清理完成: 删除${deletedFiles}个文件, 释放${(freedSpace / 1024 / 1024).toFixed(2)}MB空间`,
      );
      return { deletedFiles, freedSpace };
    } catch (error) {
      this.logger.error(`清理缩略图文件失败: ${error.message}`, error.stack);
      return { deletedFiles: 0, freedSpace: 0 };
    }
  }

  /**
   * 计算关键帧时间戳
   * @param duration 视频时长
   * @param maxKeyFrames 最大关键帧数
   * @param minInterval 最小间隔
   * @returns number[] 时间戳数组
   */
  private calculateKeyFrameTimestamps(
    duration: number,
    maxKeyFrames: number,
    minInterval: number,
  ): number[] {
    const timestamps: number[] = [];

    // 固定关键点
    const keyPoints = [0.1, 0.25, 0.5, 0.75, 0.9]; // 10%, 25%, 50%, 75%, 90%

    for (const point of keyPoints) {
      const timestamp = duration * point;
      if (timestamp >= minInterval || timestamps.length === 0) {
        timestamps.push(timestamp);
      }
    }

    // 如果还需要更多关键帧，均匀分布
    if (
      timestamps.length < maxKeyFrames &&
      duration > minInterval * maxKeyFrames
    ) {
      const interval = duration / maxKeyFrames;

      for (let i = 1; i <= maxKeyFrames; i++) {
        const timestamp = i * interval;
        if (!timestamps.some((t) => Math.abs(t - timestamp) < minInterval)) {
          timestamps.push(timestamp);
        }
      }
    }

    return timestamps.sort((a, b) => a - b).slice(0, maxKeyFrames);
  }
}
