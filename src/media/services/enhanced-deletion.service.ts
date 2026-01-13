import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { StorageFactoryService } from '../../upload/services/storage-factory.service';
import { VideoProcessingService } from '../../video-processing/services/video-processing.service';
import { DeletionResult, DeletionSummary } from '../dto/enhanced-delete.dto';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Prisma } from '@prisma/client';
import { getProcessedMediaDir } from 'src/common/utils/storage-path.util';

@Injectable()
export class EnhancedDeletionService {
  private readonly logger = new Logger(EnhancedDeletionService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageFactory: StorageFactoryService,
    private readonly videoProcessingService: VideoProcessingService,
  ) {}

  /**
   * 增强的媒体删除 - 包含完整的清理验证
   * @param mediaIds 媒体ID数组
   * @param adminId 管理员ID
   * @param options 删除选项
   */
  async enhancedDelete(
    mediaIds: string[],
    adminId: number,
    options: {
      forceDelete?: boolean;
      createBackup?: boolean;
      reason?: string;
    } = {},
  ): Promise<DeletionSummary> {
    const results: DeletionResult[] = [];
    let totalFilesCleanedUp = 0;
    let totalSpaceFreed = 0;

    this.logger.log(`🗑️ 开始增强删除操作，媒体数量: ${mediaIds.length}`);

    for (const mediaId of mediaIds) {
      try {
        const result = await this.deleteMediaWithValidation(
          mediaId,
          adminId,
          options,
        );
        results.push(result);

        if (result.success) {
          const cleanedCount =
            (result.filesDeleted.mainFile ? 1 : 0) +
            (result.filesDeleted.thumbnail ? 1 : 0) +
            (result.filesDeleted.originalFile ? 1 : 0) +
            (result.filesDeleted.processedFiles ? 1 : 0) +
            result.filesDeleted.qualityFiles +
            result.filesDeleted.extraFiles;
          totalFilesCleanedUp += cleanedCount;
          totalSpaceFreed += result.spaceFreed;
        }
      } catch (error) {
        results.push({
          success: false,
          mediaId,
          message: `删除失败: ${error.message}`,
          filesDeleted: {
            mainFile: false,
            thumbnail: false,
            processedFiles: false,
            qualityFiles: 0,
            originalFile: false,
            extraFiles: 0,
          },
          spaceFreed: 0,
          error: error.message,
        });
      }
    }

    const summary: DeletionSummary = {
      totalRequested: mediaIds.length,
      successfulDeletions: results.filter((r) => r.success).length,
      failedDeletions: results.filter((r) => !r.success).length,
      filesCleanedUp: totalFilesCleanedUp,
      spaceFree: totalSpaceFreed,
      results,
    };

    const freedMB = summary.spaceFree / 1024 / 1024;
    this.logger.log(
      `✅ 删除操作完成: ${summary.successfulDeletions}/${summary.totalRequested} 成功，预计释放 ${freedMB.toFixed(2)} MB 空间`,
    );
    return summary;
  }

  /**
   * 删除单个媒体并验证清理结果
   */
  private async deleteMediaWithValidation(
    mediaId: string,
    adminId: number,
    options: any,
  ): Promise<DeletionResult> {
    const result: DeletionResult = {
      success: false,
      mediaId,
      message: '',
      filesDeleted: {
        mainFile: false,
        thumbnail: false,
        processedFiles: false,
        qualityFiles: 0,
        originalFile: false,
        extraFiles: 0,
      },
      spaceFreed: 0,
    };

    // 1. 获取媒体信息
    const media = await this.databaseService.media.findUnique({
      where: { id: mediaId },
      include: {
        video_qualities: true,
      },
    });

    if (!media) {
      result.message = '媒体不存在';
      return result;
    }

    // 2. 创建备份（如果需要）
    if (options.createBackup) {
      try {
        await this.createDeletionBackup(media);
        result.backupCreated = true;
      } catch (error) {
        this.logger.warn(`创建备份失败: ${error.message}`);
      }
    }

    // 3. 删除物理文件
    const storageService = this.storageFactory.getStorage();
    let spaceFreed = 0;

    // 主文件
    if (media.url) {
      result.filesDeleted.mainFile = await storageService.deleteFile(media.url);
      if (result.filesDeleted.mainFile) {
        spaceFreed += media.size ?? 0;
      }
    }

    // 缩略图
    if (media.thumbnail_url) {
      result.filesDeleted.thumbnail = await storageService.deleteFile(
        media.thumbnail_url,
      );
    }

    // 质量文件
    for (const quality of media.video_qualities || []) {
      if (quality.url && (await storageService.deleteFile(quality.url))) {
        result.filesDeleted.qualityFiles++;
        if (typeof quality.size === 'number') {
          spaceFreed += quality.size;
        }
      }
    }

    // 原始文件（如果存在）
    const sourceMetadataRaw = media.source_metadata;
    const sourceMetadata = isJsonObject(sourceMetadataRaw)
      ? sourceMetadataRaw
      : ({} as Prisma.JsonObject);
    const originalUrl = getStringValue(sourceMetadata, 'original_file_url');
    if (
      originalUrl &&
      originalUrl !== media.url &&
      originalUrl !== media.thumbnail_url
    ) {
      if (await storageService.deleteFile(originalUrl)) {
        result.filesDeleted.originalFile = true;
        const originalSize = getNumberValue(
          sourceMetadata,
          'original_file_size',
        );
        if (originalSize) {
          spaceFreed += originalSize;
        }
      }
    }

    // 清理 manifest 中的附加文件
    const additionalFiles = collectAdditionalFiles(sourceMetadata, {
      mainUrl: media.url,
      thumbnailUrl: media.thumbnail_url,
      qualityUrls: (media.video_qualities ?? [])
        .map((quality) => quality.url)
        .filter((url): url is string => typeof url === 'string' && !!url),
      originalUrl,
    });
    for (const url of additionalFiles) {
      if (await storageService.deleteFile(url)) {
        result.filesDeleted.extraFiles++;
      }
    }

    // 4. 清理处理文件并验证
    if (media.media_type === 'VIDEO') {
      result.filesDeleted.processedFiles =
        await this.cleanupAndVerifyProcessedFiles(mediaId);
    }

    // 5. 删除数据库记录
    await this.databaseService.$transaction([
      this.databaseService.videoQuality.deleteMany({
        where: { media_id: mediaId },
      }),
      this.databaseService.mediaTag.deleteMany({
        where: { media_id: mediaId },
      }),
      this.databaseService.comment.deleteMany({ where: { media_id: mediaId } }),
      this.databaseService.favorite.deleteMany({
        where: { media_id: mediaId },
      }),
      this.databaseService.like.deleteMany({ where: { media_id: mediaId } }),
      this.databaseService.downloadRecord.deleteMany({
        where: { media_id: mediaId },
      }),
      this.databaseService.upload.updateMany({
        where: { media_id: mediaId },
        data: { media_id: null },
      }),
      this.databaseService.mediaRecycleLog.deleteMany({
        where: { media_id: mediaId },
      }),
      this.databaseService.media.delete({ where: { id: mediaId } }),
    ]);

    // 6. 记录删除日志
    await this.logDeletion(mediaId, adminId, options.reason, result);

    result.success = true;
    result.message = '删除成功';
    result.spaceFreed = spaceFreed;

    this.logger.log(`✅ 媒体删除完成: ${mediaId}`);
    return result;
  }

  /**
   * 清理处理文件并验证结果
   */
  private async cleanupAndVerifyProcessedFiles(
    mediaId: string,
  ): Promise<boolean> {
    try {
      const processedDir = getProcessedMediaDir(mediaId);

      this.logger.debug(`🔍 检查处理目录: ${processedDir}`);

      // 删除前检查目录是否存在
      const existsBefore = await fs.pathExists(processedDir);
      if (!existsBefore) {
        this.logger.debug(`⚠️ 处理目录不存在: ${processedDir}`);
        return true; // 目录不存在，认为清理成功
      }

      // 执行清理
      await this.videoProcessingService.cleanupProcessingFiles(mediaId);

      // 验证清理结果
      const existsAfter = await fs.pathExists(processedDir);

      if (existsAfter) {
        this.logger.warn(`⚠️ 处理目录仍然存在: ${processedDir}`);

        // 尝试强制删除
        try {
          await fs.remove(processedDir);
          const finalCheck = await fs.pathExists(processedDir);

          if (!finalCheck) {
            this.logger.log(`✅ 强制删除成功: ${processedDir}`);
            return true;
          } else {
            this.logger.error(`❌ 强制删除失败: ${processedDir}`);
            return false;
          }
        } catch (error) {
          this.logger.error(`❌ 强制删除出错: ${error.message}`);
          return false;
        }
      } else {
        this.logger.log(`✅ 处理目录清理成功: ${processedDir}`);
        return true;
      }
    } catch (error) {
      this.logger.error(`❌ 清理处理文件失败: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * 创建删除备份
   */
  private async createDeletionBackup(media: any): Promise<void> {
    const backupDir = path.join(process.cwd(), 'backups', 'deleted-media');
    await fs.ensureDir(backupDir);

    const backupFile = path.join(backupDir, `${media.id}-${Date.now()}.json`);
    await fs.writeJson(backupFile, {
      media,
      deletedAt: new Date().toISOString(),
      reason: 'Admin deletion with backup',
    });

    this.logger.log(`💾 备份已创建: ${backupFile}`);
  }

  /**
   * 记录删除操作
   */
  private async logDeletion(
    mediaId: string,
    adminId: number,
    reason: string,
    result: DeletionResult,
  ): Promise<void> {
    const logEntry = {
      mediaId,
      adminId,
      reason,
      timestamp: new Date().toISOString(),
      result,
    };

    const logDir = path.join(process.cwd(), 'logs', 'deletions');
    await fs.ensureDir(logDir);

    const logFile = path.join(
      logDir,
      `deletion-${new Date().toISOString().split('T')[0]}.log`,
    );
    await fs.appendFile(logFile, JSON.stringify(logEntry) + '\n');
  }

  /**
   * 软删除媒体
   */
  async softDelete(
    mediaIds: string[],
    userId: number,
    reason: string,
    scheduledDeletionDays: number = 30,
  ): Promise<DeletionSummary> {
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + scheduledDeletionDays);

    const results: DeletionResult[] = [];

    for (const mediaId of mediaIds) {
      try {
        await this.databaseService.media.update({
          where: { id: mediaId },
          data: {
            visibility: 'HIDDEN',
            // 可以添加 deleted_at, scheduled_hard_delete_at 等字段
            updated_at: new Date(),
          },
        });

        results.push({
          success: true,
          mediaId,
          message: `软删除成功，计划于 ${scheduledDate.toLocaleDateString()} 硬删除`,
          filesDeleted: {
            mainFile: false,
            thumbnail: false,
            processedFiles: false,
            qualityFiles: 0,
            originalFile: false,
            extraFiles: 0,
          },
          spaceFreed: 0,
        });
      } catch (error) {
        results.push({
          success: false,
          mediaId,
          message: `软删除失败: ${error.message}`,
          filesDeleted: {
            mainFile: false,
            thumbnail: false,
            processedFiles: false,
            qualityFiles: 0,
            originalFile: false,
            extraFiles: 0,
          },
          spaceFreed: 0,
          error: error.message,
        });
      }
    }

    return {
      totalRequested: mediaIds.length,
      successfulDeletions: results.filter((r) => r.success).length,
      failedDeletions: results.filter((r) => !r.success).length,
      filesCleanedUp: 0,
      spaceFree: 0,
      results,
    };
  }

  /**
   * 获取待硬删除的媒体列表
   */
  async getPendingHardDeletion(
    limit: number = 50,
  ): Promise<Array<{ id: string; cleanup_scheduled_at: Date | null }>> {
    try {
      const pending = await this.databaseService.media.findMany({
        where: {
          deleted_at: { not: null },
          cleanup_scheduled_at: {
            not: null,
            lte: new Date(),
          },
        },
        select: {
          id: true,
          cleanup_scheduled_at: true,
        },
        orderBy: {
          cleanup_scheduled_at: 'asc',
        },
        take: limit,
      });

      this.logger.debug(`待硬删除媒体数量: ${pending.length}`);
      return pending;
    } catch (error) {
      this.logger.error(`查询待硬删除媒体失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 执行定期硬删除任务
   */
  async performScheduledHardDeletion(
    limit: number = 50,
    options: {
      reason?: string;
      createBackup?: boolean;
      forceDelete?: boolean;
      operatorId?: number;
    } = {},
  ): Promise<DeletionSummary> {
    const pendingDeletions = await this.getPendingHardDeletion(limit);

    if (pendingDeletions.length === 0) {
      return {
        totalRequested: 0,
        successfulDeletions: 0,
        failedDeletions: 0,
        filesCleanedUp: 0,
        spaceFree: 0,
        results: [],
      };
    }

    const mediaIds = pendingDeletions.map((media) => media.id);
    return this.enhancedDelete(mediaIds, options.operatorId ?? 0, {
      reason: options.reason ?? 'Scheduled hard deletion',
      createBackup: options.createBackup ?? false,
      forceDelete: options.forceDelete ?? true,
    });
  }
}

function isJsonObject(
  value: Prisma.JsonValue | null | undefined,
): value is Prisma.JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function getStringValue(obj: Prisma.JsonObject, key: string): string | null {
  const value = obj[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function getNumberValue(obj: Prisma.JsonObject, key: string): number | null {
  const value = obj[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getObjectValue(
  obj: Prisma.JsonObject,
  key: string,
): Prisma.JsonObject | null {
  const value = obj[key];
  return isJsonObject(value) ? value : null;
}

function collectAdditionalFiles(
  metadata: Prisma.JsonObject,
  context: {
    mainUrl?: string | null;
    thumbnailUrl?: string | null;
    qualityUrls?: string[];
    originalUrl?: string | null;
  },
): string[] {
  const urls = new Set<string>();
  const skip = new Set(
    [context.mainUrl, context.thumbnailUrl, context.originalUrl]
      .filter((url): url is string => typeof url === 'string' && !!url)
      .concat(context.qualityUrls ?? []),
  );

  const manifest = getObjectValue(metadata, 'cleanup_manifest');
  if (manifest) {
    const keys = ['files', 'thumbnails', 'qualities', 'extras'];
    for (const key of keys) {
      const value = manifest[key];
      if (Array.isArray(value)) {
        value
          .filter((item): item is string => typeof item === 'string' && !!item)
          .forEach((url) => {
            if (!skip.has(url)) {
              urls.add(url);
            }
          });
      }
    }
  }

  const quickCover = getStringValue(metadata, 'quick_cover_url');
  if (quickCover && !skip.has(quickCover)) {
    urls.add(quickCover);
  }

  return Array.from(urls);
}
