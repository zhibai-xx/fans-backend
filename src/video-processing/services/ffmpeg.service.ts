import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import execa = require('execa');
import * as ffmpegStatic from 'ffmpeg-static';
import * as ffprobeStatic from 'ffprobe-static';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  bitrate: number;
  fps: number;
  format: string;
  size: number;
  codec: string;
}

export interface VideoQuality {
  name: string;
  width: number;
  height: number;
  bitrate: string;
  maxBitrate: string;
  bufsize: string;
}

/**
 * FFmpeg服务 - 使用原生FFmpeg CLI替代废弃的fluent-ffmpeg
 * 
 * 功能包括：
 * - 视频元数据提取
 * - 视频转码和格式转换
 * - 多分辨率视频生成
 * - 缩略图生成
 * - 视频片段提取
 * - 音频流处理
 */
@Injectable()
export class FFmpegService {
  private readonly logger = new Logger(FFmpegService.name);
  private readonly ffmpegPath: string;
  private readonly ffprobePath: string;

  // 预设的视频质量配置
  private readonly videoQualities: Record<string, VideoQuality> = {
    '1080p': {
      name: '1080p',
      width: 1920,
      height: 1080,
      bitrate: '5000k',
      maxBitrate: '7500k',
      bufsize: '10000k',
    },
    '720p': {
      name: '720p',
      width: 1280,
      height: 720,
      bitrate: '2500k',
      maxBitrate: '3750k',
      bufsize: '5000k',
    },
    '480p': {
      name: '480p',
      width: 854,
      height: 480,
      bitrate: '1000k',
      maxBitrate: '1500k',
      bufsize: '2000k',
    },
    '360p': {
      name: '360p',
      width: 640,
      height: 360,
      bitrate: '600k',
      maxBitrate: '900k',
      bufsize: '1200k',
    },
  };

  constructor(private configService: ConfigService) {
    // 确保FFmpeg和FFprobe路径可用
    this.ffmpegPath = (ffmpegStatic as any) || 'ffmpeg';
    this.ffprobePath = ffprobeStatic.path || 'ffprobe';

    this.logger.log(`FFmpeg path: ${this.ffmpegPath}`);
    this.logger.log(`FFprobe path: ${this.ffprobePath}`);
  }

  /**
   * 验证视频文件是否有效
   * @param videoPath 视频文件路径
   * @returns boolean
   */
  async isValidVideo(videoPath: string): Promise<boolean> {
    try {
      await this.getVideoMetadata(videoPath);
      return true;
    } catch (error) {
      this.logger.warn(`视频文件验证失败: ${videoPath} - ${error.message}`);
      return false;
    }
  }

  /**
   * 提取视频元数据
   * @param videoPath 视频文件路径
   * @returns 视频元数据
   */
  async getVideoMetadata(videoPath: string): Promise<VideoMetadata> {
    this.logger.debug(`开始提取视频元数据: ${videoPath}`);

    try {
      const { stdout } = await execa(this.ffprobePath, [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        videoPath
      ]);

      const metadata = JSON.parse(stdout);
      const videoStream = metadata.streams.find((stream: any) => stream.codec_type === 'video');

      if (!videoStream) {
        throw new Error('未找到视频流');
      }

      const result: VideoMetadata = {
        duration: parseFloat(metadata.format.duration?.toString() || '0') || 0,
        width: videoStream.width || 0,
        height: videoStream.height || 0,
        bitrate: parseInt(metadata.format.bit_rate?.toString() || '0') || 0,
        fps: this.parseFPS((videoStream.r_frame_rate || videoStream.avg_frame_rate) || '') || 0,
        format: metadata.format.format_name || 'unknown',
        size: parseInt(metadata.format.size?.toString() || '0') || 0,
        codec: videoStream.codec_name || 'unknown',
      };

      this.logger.debug(`视频元数据提取成功: ${result.width}x${result.height}, ${result.duration}s, ${result.format}`);
      return result;

    } catch (error) {
      this.logger.error(`提取视频元数据失败: ${error.message}`, error.stack);
      throw new Error(`提取视频元数据失败: ${error.message}`);
    }
  }

  /**
   * 转码视频到指定质量
   * @param inputPath 输入视频路径
   * @param outputPath 输出视频路径
   * @param quality 质量配置
   * @param options 额外选项
   * @returns Promise<void>
   */
  async transcodeVideo(
    inputPath: string,
    outputPath: string,
    quality: VideoQuality,
    options: {
      preset?: string;
      crf?: number;
      copyAudio?: boolean;
    } = {}
  ): Promise<void> {
    const { preset = 'medium', crf = 23, copyAudio = false } = options;

    this.logger.log(`开始转码视频: ${inputPath} -> ${outputPath} (${quality.name})`);

    // 确保输出目录存在
    await fs.ensureDir(path.dirname(outputPath));

    const args = [
      '-i', inputPath,
      '-c:v', 'libx264',
      '-preset', preset,
      '-crf', crf.toString(),
      '-vf', `scale=${quality.width}:${quality.height}`,
      '-b:v', quality.bitrate,
      '-maxrate', quality.maxBitrate,
      '-bufsize', quality.bufsize,
      '-movflags', '+faststart',
      '-pix_fmt', 'yuv420p',
    ];

    // 音频处理
    if (copyAudio) {
      args.push('-c:a', 'copy');
    } else {
      args.push('-c:a', 'aac', '-b:a', '128k');
    }

    // 输出文件
    args.push('-y', outputPath);

    try {
      const { stdout, stderr } = await execa(this.ffmpegPath, args);
      this.logger.debug(`FFmpeg输出: ${stdout}`);
      this.logger.log(`视频转码完成: ${outputPath}`);
    } catch (error) {
      this.logger.error(`视频转码失败: ${error.message}`, error.stderr);
      throw new Error(`视频转码失败: ${error.message}`);
    }
  }

  /**
   * 生成视频缩略图
   * @param videoPath 视频文件路径
   * @param outputPath 缩略图输出路径
   * @param options 缩略图选项
   * @returns Promise<string[]>
   */
  async generateThumbnails(
    videoPath: string,
    outputPath: string,
    options: {
      count?: number;
      width?: number;
      height?: number;
      timeOffset?: number;
      interval?: number;
    } = {}
  ): Promise<string[]> {
    const {
      count = 1,
      width = 320,
      height = 240,
      timeOffset = 10,
      interval = 10
    } = options;

    this.logger.log(`开始生成视频缩略图: ${videoPath} -> ${outputPath} (${count}张, ${width}x${height})`);

    // 确保输出目录存在
    const outputDir = path.dirname(outputPath);
    await fs.ensureDir(outputDir);

    const thumbnails: string[] = [];

    try {
      if (count === 1) {
        // 生成单张缩略图 - 保持比例，不强制拉伸
        const args = [
          '-i', videoPath,
          '-ss', timeOffset.toString(),
          '-vframes', '1',
          '-vf', `scale=${width}:${height}`,
          '-y', outputPath
        ];

        await execa(this.ffmpegPath, args);
        thumbnails.push(outputPath);
        this.logger.log(`单张缩略图生成完成: ${outputPath}`);

      } else {
        // 生成多张缩略图
        const baseName = path.basename(outputPath, path.extname(outputPath));
        const ext = path.extname(outputPath);

        for (let i = 0; i < count; i++) {
          const timestamp = timeOffset + i * interval;
          const thumbPath = path.join(outputDir, `${baseName}_${i + 1}${ext}`);

          const args = [
            '-i', videoPath,
            '-ss', timestamp.toString(),
            '-vframes', '1',
            '-vf', `scale=${width}:${height}`,
            '-y', thumbPath
          ];

          await execa(this.ffmpegPath, args);
          thumbnails.push(thumbPath);
        }

        this.logger.log(`多张缩略图生成完成: ${thumbnails.length}张`);
      }

      return thumbnails;

    } catch (error) {
      this.logger.error(`生成缩略图失败: ${error.message}`, error.stderr);
      throw new Error(`生成缩略图失败: ${error.message}`);
    }
  }

  /**
   * 生成视频预览精灵图
   * @param videoPath 视频文件路径
   * @param outputImagePath 精灵图输出路径
   * @param options 精灵图选项
   * @returns Promise<{imagePath: string, vttPath: string, thumbnails: Array<{time: number, x: number, y: number}>}>
   */
  async generateSpriteImage(
    videoPath: string,
    outputImagePath: string,
    options: {
      interval?: number;
      thumbWidth?: number;
      thumbHeight?: number;
      columns?: number;
    } = {}
  ): Promise<{ imagePath: string, vttPath: string, thumbnails: Array<{ time: number, x: number, y: number }> }> {
    const {
      interval = 10,
      thumbWidth = 160,
      thumbHeight = 90,
      columns = 10
    } = options;

    this.logger.log(`开始生成视频精灵图: ${videoPath} -> ${outputImagePath}`);

    // 获取视频时长
    const metadata = await this.getVideoMetadata(videoPath);
    const duration = metadata.duration;
    const thumbCount = Math.floor(duration / interval);

    if (thumbCount === 0) {
      throw new Error('视频时长过短，无法生成精灵图');
    }

    // 确保输出目录存在
    const outputDir = path.dirname(outputImagePath);
    await fs.ensureDir(outputDir);

    // 创建临时目录存储单个缩略图
    const tempDir = path.join(outputDir, 'temp_thumbnails');
    await fs.ensureDir(tempDir);

    try {
      // 1. 生成所有缩略图
      const tempThumbnails: string[] = [];
      for (let i = 0; i < thumbCount; i++) {
        const timestamp = i * interval;
        const tempThumbPath = path.join(tempDir, `thumb_${i.toString().padStart(4, '0')}.jpg`);

        const args = [
          '-i', videoPath,
          '-ss', timestamp.toString(),
          '-vframes', '1',
          '-vf', `scale=${thumbWidth}:${thumbHeight}`,
          '-y', tempThumbPath
        ];

        await execa(this.ffmpegPath, args);
        tempThumbnails.push(tempThumbPath);
      }

      // 2. 计算精灵图尺寸
      const rows = Math.ceil(thumbCount / columns);
      const spriteWidth = columns * thumbWidth;
      const spriteHeight = rows * thumbHeight;

      // 3. 合并所有缩略图为精灵图
      const tilePattern = `${columns}x${rows}`;
      const args = [
        '-i', path.join(tempDir, 'thumb_%04d.jpg'),
        '-filter_complex', `tile=${tilePattern}`,
        '-y', outputImagePath
      ];

      await execa(this.ffmpegPath, args);

      // 4. 生成VTT文件
      const vttPath = outputImagePath.replace(path.extname(outputImagePath), '.vtt');
      const thumbnails = this.generateVTTFile(vttPath, thumbCount, interval, thumbWidth, thumbHeight, columns, outputImagePath);

      // 5. 清理临时文件
      await fs.remove(tempDir);

      this.logger.log(`精灵图生成完成: ${outputImagePath}, VTT: ${vttPath}`);
      return { imagePath: outputImagePath, vttPath, thumbnails };

    } catch (error) {
      // 清理临时文件
      await fs.remove(tempDir).catch(() => { });
      this.logger.error(`生成精灵图失败: ${error.message}`, error.stderr);
      throw new Error(`生成精灵图失败: ${error.message}`);
    }
  }

  /**
   * 生成HLS切片
   * @param inputPath 输入视频路径
   * @param outputDir 输出目录
   * @param qualities 质量列表
   * @returns Promise<string> 主播放列表路径
   */
  async generateHLS(
    inputPath: string,
    outputDir: string,
    qualities: VideoQuality[]
  ): Promise<string> {
    this.logger.log(`开始生成HLS流: ${inputPath} -> ${outputDir}`);

    // 确保输出目录存在
    await fs.ensureDir(outputDir);

    try {
      // 为每个质量生成HLS流
      const playlistPaths: string[] = [];

      for (const quality of qualities) {
        const qualityDir = path.join(outputDir, quality.name);
        await fs.ensureDir(qualityDir);

        const playlistPath = path.join(qualityDir, 'playlist.m3u8');
        const segmentPattern = path.join(qualityDir, 'segment_%03d.ts');

        const args = [
          '-i', inputPath,
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-vf', `scale=${quality.width}:${quality.height}`,
          '-b:v', quality.bitrate,
          '-maxrate', quality.maxBitrate,
          '-bufsize', quality.bufsize,
          '-b:a', '128k',
          '-f', 'hls',
          '-hls_time', '10',
          '-hls_list_size', '0',
          '-hls_segment_filename', segmentPattern,
          '-y', playlistPath
        ];

        await execa(this.ffmpegPath, args);
        playlistPaths.push(playlistPath);

        this.logger.debug(`HLS质量流生成完成: ${quality.name} -> ${playlistPath}`);
      }

      // 生成主播放列表
      const masterPlaylistPath = path.join(outputDir, 'master.m3u8');
      await this.generateMasterPlaylist(masterPlaylistPath, qualities);

      this.logger.log(`HLS流生成完成: ${masterPlaylistPath}`);
      return masterPlaylistPath;

    } catch (error) {
      this.logger.error(`HLS流生成失败: ${error.message}`, error.stderr);
      throw new Error(`HLS流生成失败: ${error.message}`);
    }
  }

  /**
   * 解析帧率字符串
   * @param fps 帧率字符串 (例如: "30/1", "29.97")
   * @returns number
   */
  private parseFPS(fps: string): number {
    if (!fps) return 0;

    if (fps.includes('/')) {
      const [numerator, denominator] = fps.split('/').map(Number);
      return denominator ? numerator / denominator : 0;
    }

    return parseFloat(fps) || 0;
  }

  /**
   * 生成VTT文件用于视频预览
   * @param vttPath VTT文件路径
   * @param thumbCount 缩略图数量
   * @param interval 时间间隔
   * @param thumbWidth 缩略图宽度
   * @param thumbHeight 缩略图高度
   * @param columns 列数
   * @param spriteImagePath 精灵图路径
   * @returns Array<{time: number, x: number, y: number}>
   */
  private generateVTTFile(
    vttPath: string,
    thumbCount: number,
    interval: number,
    thumbWidth: number,
    thumbHeight: number,
    columns: number,
    spriteImagePath: string
  ): Array<{ time: number, x: number, y: number }> {
    const thumbnails: Array<{ time: number, x: number, y: number }> = [];
    let vttContent = 'WEBVTT\n\n';

    for (let i = 0; i < thumbCount; i++) {
      const time = i * interval;
      const x = (i % columns) * thumbWidth;
      const y = Math.floor(i / columns) * thumbHeight;

      thumbnails.push({ time, x, y });

      const startTime = this.formatVTTTime(time);
      const endTime = this.formatVTTTime(Math.min(time + interval, thumbCount * interval));
      const spriteFileName = path.basename(spriteImagePath);

      vttContent += `${startTime} --> ${endTime}\n`;
      vttContent += `${spriteFileName}#xywh=${x},${y},${thumbWidth},${thumbHeight}\n\n`;
    }

    fs.writeFileSync(vttPath, vttContent);
    return thumbnails;
  }

  /**
   * 格式化时间为VTT格式
   * @param seconds 秒数
   * @returns string
   */
  private formatVTTTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds - Math.floor(seconds)) * 1000);

    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }

  /**
   * 生成HLS主播放列表
   * @param masterPlaylistPath 主播放列表路径
   * @param qualities 质量列表
   */
  private async generateMasterPlaylist(
    masterPlaylistPath: string,
    qualities: VideoQuality[]
  ): Promise<void> {
    let content = '#EXTM3U\n#EXT-X-VERSION:3\n\n';

    for (const quality of qualities) {
      const bandwidth = parseInt(quality.bitrate) * 1000; // 转换为bps
      content += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${quality.width}x${quality.height}\n`;
      content += `${quality.name}/playlist.m3u8\n`;
    }

    await fs.writeFile(masterPlaylistPath, content);
  }

  /**
   * 执行FFmpeg命令
   * @param args FFmpeg命令参数
   * @returns Promise<void>
   */
  async executeFFmpeg(args: string[]): Promise<void> {
    this.logger.debug(`执行FFmpeg命令: ${this.ffmpegPath} ${args.join(' ')}`);

    try {
      const { stdout, stderr } = await execa(this.ffmpegPath, args);
      if (stdout) this.logger.debug(`FFmpeg stdout: ${stdout}`);
      if (stderr) this.logger.debug(`FFmpeg stderr: ${stderr}`);
    } catch (error) {
      this.logger.error(`FFmpeg执行失败: ${error.message}`, error.stderr);
      throw new Error(`FFmpeg执行失败: ${error.message}`);
    }
  }

  /**
   * 获取可用的质量配置 - 根据原始视频比例动态调整
   * @param originalWidth 原始宽度
   * @param originalHeight 原始高度
   * @returns VideoQuality[]
   */
  getAvailableQualities(originalWidth: number, originalHeight: number): VideoQuality[] {
    const availableQualities: VideoQuality[] = [];
    const originalAspectRatio = originalWidth / originalHeight;
    const isVertical = originalHeight > originalWidth;

    this.logger.debug(`原始视频尺寸: ${originalWidth}×${originalHeight}, 比例: ${originalAspectRatio.toFixed(2)}, 竖屏: ${isVertical}`);

    // 根据原始视频比例调整质量配置
    for (const [key, baseQuality] of Object.entries(this.videoQualities)) {
      let targetWidth: number, targetHeight: number;

      if (isVertical) {
        // 竖屏视频：以高度为基准，按比例计算宽度
        targetHeight = Math.min(baseQuality.height, originalHeight);
        targetWidth = Math.round(targetHeight * originalAspectRatio);

        // 确保尺寸是偶数（libx264要求）
        targetWidth = targetWidth % 2 === 0 ? targetWidth : targetWidth - 1;
        targetHeight = targetHeight % 2 === 0 ? targetHeight : targetHeight - 1;
      } else {
        // 横屏视频：以宽度为基准，按比例计算高度
        targetWidth = Math.min(baseQuality.width, originalWidth);
        targetHeight = Math.round(targetWidth / originalAspectRatio);

        // 确保尺寸是偶数（libx264要求）
        targetWidth = targetWidth % 2 === 0 ? targetWidth : targetWidth - 1;
        targetHeight = targetHeight % 2 === 0 ? targetHeight : targetHeight - 1;
      }

      // 确保生成的尺寸不超过原始尺寸
      if (targetWidth <= originalWidth && targetHeight <= originalHeight) {
        const adjustedQuality: VideoQuality = {
          ...baseQuality,
          width: targetWidth,
          height: targetHeight,
        };

        availableQualities.push(adjustedQuality);
        this.logger.debug(`调整后的${key}质量: ${targetWidth}×${targetHeight}`);
      }
    }

    // 如果没有合适的预设质量，至少添加一个保持原始比例的质量
    if (availableQualities.length === 0) {
      // 生成一个中等质量版本，保持原始比例
      const maxDimension = Math.max(originalWidth, originalHeight);
      let targetWidth = originalWidth;
      let targetHeight = originalHeight;

      // 如果原始尺寸太大，按比例缩小
      if (maxDimension > 720) {
        const scaleFactor = 720 / maxDimension;
        targetWidth = Math.round(originalWidth * scaleFactor);
        targetHeight = Math.round(originalHeight * scaleFactor);
      }

      // 确保尺寸是偶数（libx264要求）
      targetWidth = targetWidth % 2 === 0 ? targetWidth : targetWidth - 1;
      targetHeight = targetHeight % 2 === 0 ? targetHeight : targetHeight - 1;

      availableQualities.push({
        name: 'original',
        width: targetWidth,
        height: targetHeight,
        bitrate: '2000k',
        maxBitrate: '3000k',
        bufsize: '4000k',
      });

      this.logger.debug(`生成原始比例质量: ${targetWidth}×${targetHeight}`);
    }

    return availableQualities.sort((a, b) => b.height - a.height); // 按分辨率降序排列
  }
}