import { Injectable, Logger } from '@nestjs/common';
import { FFmpegService, VideoQuality, VideoMetadata } from './ffmpeg.service';
import * as path from 'path';
import * as fs from 'fs-extra';

/**
 * HLS服务 - 使用现代FFmpeg CLI实现HLS流媒体生成
 *
 * 功能包括：
 * - 自适应码率流(ABR)生成
 * - 多分辨率HLS流
 * - 主播放列表生成
 * - 分片文件管理
 * - CDN友好的配置
 */
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return '未知错误';
};

const getErrorStack = (error: unknown): string | undefined => {
  return error instanceof Error ? error.stack : undefined;
};

@Injectable()
export class HlsService {
  private readonly logger = new Logger(HlsService.name);

  constructor(private readonly ffmpegService: FFmpegService) {}

  /**
   * 生成HLS自适应码率流
   * @param inputPath 输入视频路径
   * @param outputDir 输出目录
   * @param options HLS选项
   * @returns Promise<{masterPlaylist: string, qualities: Array<{quality: VideoQuality, playlistPath: string}>}>
   */
  async generateAdaptiveHLS(
    inputPath: string,
    outputDir: string,
    options: {
      segmentDuration?: number;
      targetQualities?: string[];
      enableEncryption?: boolean;
      cdnBaseUrl?: string;
      metadata?: VideoMetadata;
      qualityConfigs?: VideoQuality[];
    } = {},
  ): Promise<{
    masterPlaylist: string;
    qualities: Array<{
      quality: VideoQuality;
      playlistPath: string;
      segmentCount: number;
    }>;
  }> {
    const {
      segmentDuration = 10,
      targetQualities = ['1080p', '720p', '480p'],
      enableEncryption = false,
      cdnBaseUrl = '',
      metadata,
      qualityConfigs,
    } = options;

    this.logger.log(`开始生成自适应HLS流: ${inputPath} -> ${outputDir}`);

    // 获取视频元数据
    const metadataForUse =
      metadata ?? (await this.ffmpegService.getVideoMetadata(inputPath));
    this.logger.debug(
      `视频信息: ${metadataForUse.width}x${metadataForUse.height}, ${metadataForUse.duration}s`,
    );

    let selectedQualities: VideoQuality[] = [];
    if (qualityConfigs && qualityConfigs.length > 0) {
      selectedQualities = qualityConfigs;
    } else {
      const recommended =
        this.ffmpegService.getRecommendedQualities(metadataForUse);
      selectedQualities = recommended.filter(
        (q) =>
          targetQualities.includes(q.name) || targetQualities.includes('all'),
      );
    }

    if (selectedQualities.length === 0) {
      throw new Error('没有找到适合的视频质量配置');
    }

    this.logger.debug(
      `将生成 ${selectedQualities.length} 种质量: ${selectedQualities.map((q) => q.name).join(', ')}`,
    );

    // 确保输出目录存在
    await fs.ensureDir(outputDir);

    const qualities: Array<{
      quality: VideoQuality;
      playlistPath: string;
      segmentCount: number;
    }> = [];

    try {
      // 为每个质量生成HLS流
      for (const quality of selectedQualities) {
        const qualityResult = await this.generateSingleQualityHLS(
          inputPath,
          outputDir,
          quality,
          metadataForUse,
          {
            segmentDuration,
            enableEncryption,
            cdnBaseUrl,
          },
        );

        qualities.push(qualityResult);
      }

      // 生成主播放列表
      const masterPlaylist = await this.generateMasterPlaylist(
        outputDir,
        qualities,
        { cdnBaseUrl },
      );

      this.logger.log(
        `HLS流生成完成: ${qualities.length} 种质量, 主播放列表: ${masterPlaylist}`,
      );
      return { masterPlaylist, qualities };
    } catch (error) {
      this.logger.error(
        `生成HLS流失败: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      // 清理部分生成的文件
      await this.cleanupPartialHLS(outputDir).catch(() => {});
      throw error;
    }
  }

  /**
   * 生成单一质量的HLS流
   * @param inputPath 输入视频路径
   * @param outputDir 输出目录
   * @param quality 质量配置
   * @param options 选项
   * @returns Promise<{quality: VideoQuality, playlistPath: string, segmentCount: number}>
   */
  private async generateSingleQualityHLS(
    inputPath: string,
    outputDir: string,
    quality: VideoQuality,
    metadata: VideoMetadata,
    options: {
      segmentDuration: number;
      enableEncryption: boolean;
      cdnBaseUrl: string;
    },
  ): Promise<{
    quality: VideoQuality;
    playlistPath: string;
    segmentCount: number;
  }> {
    void options;
    const qualityDir = path.join(outputDir, quality.name);
    await fs.ensureDir(qualityDir);

    const playlistPath = path.join(qualityDir, 'playlist.m3u8');

    this.logger.debug(`生成${quality.name}质量HLS流: ${playlistPath}`);

    try {
      // 使用FFmpegService生成HLS（委托给更通用的方法）
      await this.ffmpegService.generateHLS(
        inputPath,
        outputDir,
        [quality],
        metadata,
      );

      // 计算分片数量
      const segmentCount = await this.countHLSSegments(qualityDir);

      this.logger.debug(
        `${quality.name}质量HLS流生成完成: ${segmentCount} 个分片`,
      );

      return {
        quality,
        playlistPath,
        segmentCount,
      };
    } catch (error) {
      this.logger.error(
        `生成${quality.name}质量HLS流失败: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * 生成主播放列表
   * @param outputDir 输出目录
   * @param qualities 质量列表
   * @param options 选项
   * @returns Promise<string> 主播放列表路径
   */
  private async generateMasterPlaylist(
    outputDir: string,
    qualities: Array<{
      quality: VideoQuality;
      playlistPath: string;
      segmentCount: number;
    }>,
    options: { cdnBaseUrl?: string } = {},
  ): Promise<string> {
    const { cdnBaseUrl = '' } = options;
    const masterPlaylistPath = path.join(outputDir, 'master.m3u8');

    let content = '#EXTM3U\n';
    content += '#EXT-X-VERSION:6\n\n';

    // 按分辨率从高到低排序
    const sortedQualities = qualities.sort(
      (a, b) => b.quality.height - a.quality.height,
    );

    for (const { quality } of sortedQualities) {
      const bandwidth = this.calculateBandwidth(quality.bitrate);
      const baseUrl = cdnBaseUrl ? `${cdnBaseUrl.replace(/\/$/, '')}/` : '';

      // EXT-X-STREAM-INF标签
      content += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth}`;
      content += `,RESOLUTION=${quality.width}x${quality.height}`;
      content += `,NAME="${quality.name}"`;
      content += `\n`;

      // 播放列表URL
      content += `${baseUrl}${quality.name}/playlist.m3u8\n`;
    }

    await fs.writeFile(masterPlaylistPath, content);
    this.logger.debug(`主播放列表生成完成: ${masterPlaylistPath}`);

    return masterPlaylistPath;
  }

  /**
   * 计算HLS分片数量
   * @param qualityDir 质量目录
   * @returns Promise<number>
   */
  private async countHLSSegments(qualityDir: string): Promise<number> {
    try {
      const files = await fs.readdir(qualityDir);
      return files.filter((file) => file.endsWith('.ts')).length;
    } catch (error) {
      this.logger.warn(`统计HLS分片失败: ${getErrorMessage(error)}`);
      return 0;
    }
  }

  /**
   * 计算带宽值
   * @param bitrate 码率字符串 (例如: "2500k", "1M")
   * @returns number 带宽值(bps)
   */
  private calculateBandwidth(bitrate: string): number {
    const bitrateNum = parseInt(bitrate);

    if (bitrate.toLowerCase().includes('k')) {
      return bitrateNum * 1000;
    } else if (bitrate.toLowerCase().includes('m')) {
      return bitrateNum * 1000000;
    }

    return bitrateNum;
  }

  /**
   * 清理部分生成的HLS文件
   * @param outputDir 输出目录
   */
  private async cleanupPartialHLS(outputDir: string): Promise<void> {
    try {
      this.logger.debug(`清理部分HLS文件: ${outputDir}`);
      await fs.remove(outputDir);
    } catch (error) {
      this.logger.warn(`清理HLS文件失败: ${getErrorMessage(error)}`);
    }
  }

  /**
   * 验证HLS流的完整性
   * @param masterPlaylistPath 主播放列表路径
   * @returns Promise<{isValid: boolean, issues: string[]}>
   */
  async validateHLS(
    masterPlaylistPath: string,
  ): Promise<{ isValid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      // 检查主播放列表是否存在
      if (!(await fs.pathExists(masterPlaylistPath))) {
        issues.push('主播放列表文件不存在');
        return { isValid: false, issues };
      }

      // 读取并验证主播放列表内容
      const masterContent = await fs.readFile(masterPlaylistPath, 'utf-8');
      if (!masterContent.startsWith('#EXTM3U')) {
        issues.push('主播放列表格式不正确');
      }

      // 检查各个质量的播放列表和分片
      const outputDir = path.dirname(masterPlaylistPath);
      const qualityDirs = await fs.readdir(outputDir);

      for (const qualityDir of qualityDirs) {
        const qualityPath = path.join(outputDir, qualityDir);
        const stat = await fs.stat(qualityPath);

        if (!stat.isDirectory()) continue;

        const playlistPath = path.join(qualityPath, 'playlist.m3u8');
        if (!(await fs.pathExists(playlistPath))) {
          issues.push(`${qualityDir} 质量的播放列表缺失`);
          continue;
        }

        // 检查分片文件
        const segmentCount = await this.countHLSSegments(qualityPath);
        if (segmentCount === 0) {
          issues.push(`${qualityDir} 质量没有分片文件`);
        }
      }

      const isValid = issues.length === 0;
      this.logger.debug(
        `HLS验证完成: ${isValid ? '通过' : '失败'}, 问题数: ${issues.length}`,
      );

      return { isValid, issues };
    } catch (error) {
      this.logger.error(`HLS验证失败: ${getErrorMessage(error)}`);
      issues.push(`验证过程出错: ${getErrorMessage(error)}`);
      return { isValid: false, issues };
    }
  }

  /**
   * 获取HLS流信息
   * @param masterPlaylistPath 主播放列表路径
   * @returns Promise<{qualities: Array<{name: string, resolution: string, bandwidth: number}>, totalSize: number}>
   */
  async getHLSInfo(masterPlaylistPath: string): Promise<{
    qualities: Array<{ name: string; resolution: string; bandwidth: number }>;
    totalSize: number;
    duration: number;
  }> {
    const outputDir = path.dirname(masterPlaylistPath);
    const qualities: Array<{
      name: string;
      resolution: string;
      bandwidth: number;
    }> = [];
    let totalSize = 0;
    let duration = 0;

    try {
      // 读取主播放列表获取质量信息
      const masterContent = await fs.readFile(masterPlaylistPath, 'utf-8');
      const lines = masterContent.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('#EXT-X-STREAM-INF:')) {
          const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/);
          const resolutionMatch = line.match(/RESOLUTION=(\d+x\d+)/);
          const nameMatch = line.match(/NAME="([^"]+)"/);

          const nextLine = lines[i + 1];
          if (nextLine && !nextLine.startsWith('#')) {
            const qualityName = nameMatch
              ? nameMatch[1]
              : path.dirname(nextLine);

            qualities.push({
              name: qualityName,
              resolution: resolutionMatch ? resolutionMatch[1] : 'unknown',
              bandwidth: bandwidthMatch ? parseInt(bandwidthMatch[1]) : 0,
            });
          }
        }
      }

      // 计算总大小
      const calculateDirSize = async (dirPath: string): Promise<number> => {
        let size = 0;
        const items = await fs.readdir(dirPath);

        for (const item of items) {
          const itemPath = path.join(dirPath, item);
          const stat = await fs.stat(itemPath);

          if (stat.isFile()) {
            size += stat.size;
          } else if (stat.isDirectory()) {
            size += await calculateDirSize(itemPath);
          }
        }

        return size;
      };

      totalSize = await calculateDirSize(outputDir);

      // 获取时长（从任一质量的播放列表中读取）
      if (qualities.length > 0) {
        const firstQualityDir = path.join(outputDir, qualities[0].name);
        const firstPlaylist = path.join(firstQualityDir, 'playlist.m3u8');

        if (await fs.pathExists(firstPlaylist)) {
          const playlistContent = await fs.readFile(firstPlaylist, 'utf-8');
          const targetDurationMatch = playlistContent.match(
            /#EXT-X-TARGETDURATION:(\d+)/,
          );
          const segmentCount = (playlistContent.match(/#EXTINF:/g) || [])
            .length;

          if (targetDurationMatch) {
            duration = parseInt(targetDurationMatch[1]) * segmentCount;
          }
        }
      }

      return { qualities, totalSize, duration };
    } catch (error) {
      this.logger.error(`获取HLS信息失败: ${getErrorMessage(error)}`);
      return { qualities: [], totalSize: 0, duration: 0 };
    }
  }
}
