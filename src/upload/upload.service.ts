import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { DatabaseService } from 'src/database/database.service';
import { MediaService } from '../media/media.service';
import { StorageFactoryService } from './services/storage-factory.service';
import * as sharp from 'sharp';
import {
  InitUploadDto,
  UploadChunkDto,
  MergeChunksDto,
  InitUploadResponse,
  UploadProgressResponse,
  FileType,
} from './dto/upload.dto';
import {
  MediaSource,
  MediaType,
  Prisma,
  TagCreatorType,
  TagSource,
  TagStatus,
} from '@prisma/client';

// 定义上传状态枚举
enum UploadStatus {
  PENDING = 'PENDING',
  UPLOADING = 'UPLOADING',
  MERGING = 'MERGING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}
import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

// 性能优化配置
const PERFORMANCE_CONFIG = {
  CHUNK_MERGE_BUFFER_SIZE: 64 * 1024, // 64KB buffer for chunk merging
  MAX_CONCURRENT_UPLOADS: 5, // 最大并发上传数
  BATCH_SIZE: 10, // 批量处理大小
  CACHE_TTL: 5 * 60 * 1000, // 缓存5分钟
  MEMORY_THRESHOLD: 100 * 1024 * 1024, // 100MB内存阈值
  CLEANUP_INTERVAL: 60 * 1000, // 1分钟清理间隔
};

type UploadMetadata = {
  title?: string;
  description?: string;
  tagIds?: string[];
  tagNames?: string[];
  categoryId?: string;
  source?: MediaSource;
  sourceMetadata?: Record<string, unknown>;
  source_metadata?: Record<string, unknown>;
};

type SystemIngestFileType = 'image' | 'gif' | 'video';

type SystemIngestFileInfo = {
  size: number;
  type: SystemIngestFileType;
  lastModified: Date;
  dimensions?: {
    width: number;
    height: number;
  };
};

type SystemIngestFile = {
  id: string;
  name: string;
  path: string;
  size: number;
  type: SystemIngestFileType;
  lastModified: string;
  dimensions?: SystemIngestFileInfo['dimensions'];
};

type SystemIngestUser = {
  userId: string;
  userName: string;
  totalFiles: number;
  files: SystemIngestFile[];
};

type SystemIngestScanResult = {
  users: SystemIngestUser[];
  totalFiles: number;
  totalSize: number;
};

type SystemIngestFileSelection =
  | string
  | { path: string; name?: string; userId?: string };

type SystemIngestBatchResultItem = {
  filePath?: string;
  fileName?: string;
  uploadId?: string;
  success: boolean;
  needUpload?: boolean;
  mediaId?: string;
  error?: string;
};

type SystemIngestUploadRequest = {
  filename: string;
  fileSize: number;
  fileType: FileType;
  fileMd5: string;
  title: string;
  description: string;
  tagIds: string[];
  ingestUserId?: string | null;
  originalCreatedAt?: Date | null;
  sourceMetadata?: Record<string, unknown>;
};

type SystemIngestUploadInitResult = {
  uploadId: string;
  needUpload: boolean;
  mediaId?: string;
  chunkSize?: number;
  totalChunks?: number;
};

type SystemIngestParseResult = {
  ingestUserId: string | null;
  originalCreatedAt: Date | null;
  sourceMetadata: Record<string, unknown>;
  title: string;
  description: string;
};

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly uploadDir: string;
  private readonly tempDir: string;
  private readonly chunkDir: string;
  private readonly enableVideoFeature: boolean;
  private readonly systemIngestFileCache = new Map<
    string,
    { path: string; name: string; type: SystemIngestFileType }
  >();

  // 性能优化相关
  private readonly md5Cache = new Map<
    string,
    { md5: string; timestamp: number }
  >();
  private readonly uploadQueue = new Map<string, Promise<void>>();
  private readonly activeUploads = new Set<string>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: DatabaseService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => MediaService))
    private readonly mediaService: MediaService,
    private readonly storageFactory: StorageFactoryService,
  ) {
    // 初始化上传目录
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR') || 'uploads';
    this.tempDir = path.join(this.uploadDir, 'temp');
    this.chunkDir = path.join(this.uploadDir, 'chunks');
    this.enableVideoFeature =
      this.configService.get<string>('ENABLE_VIDEO_FEATURE') === 'true';

    // 确保目录存在
    void this.ensureDirectories();

    // 启动清理定时器
    this.startCleanupTimer();
  }

  private ensureVideoFeatureEnabled(context: string): void {
    if (!this.enableVideoFeature) {
      throw new BadRequestException(`${context}已关闭，当前阶段仅开放图片功能`);
    }
  }

  /**
   * 确保目录存在
   */
  private async ensureDirectories() {
    try {
      await fs.ensureDir(this.uploadDir);
      await fs.ensureDir(this.tempDir);
      await fs.ensureDir(this.chunkDir);
    } catch (error) {
      this.logger.error('创建上传目录失败:', error);
      throw new InternalServerErrorException('初始化上传目录失败');
    }
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      void this.cleanupExpiredData();
    }, PERFORMANCE_CONFIG.CLEANUP_INTERVAL);
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return '未知错误';
  }

  private normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((item): item is string => typeof item === 'string');
  }

  private normalizeRecord(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }
    return value as Record<string, unknown>;
  }

  private normalizeMediaSource(value: unknown): MediaSource | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const sources = Object.values(MediaSource) as string[];
    return sources.includes(value) ? (value as MediaSource) : undefined;
  }

  private parseUploadMetadata(value: unknown): UploadMetadata {
    const record = this.normalizeRecord(value);
    if (!record) {
      return {};
    }
    return {
      title: typeof record.title === 'string' ? record.title : undefined,
      description:
        typeof record.description === 'string' ? record.description : undefined,
      tagIds: this.normalizeStringArray(record.tagIds),
      tagNames: this.normalizeStringArray(record.tagNames),
      categoryId:
        typeof record.categoryId === 'string' ? record.categoryId : undefined,
      source: this.normalizeMediaSource(record.source),
      sourceMetadata: this.normalizeRecord(record.sourceMetadata),
      source_metadata: this.normalizeRecord(record.source_metadata),
    };
  }

  private mergeSourceMetadata(
    metadata: UploadMetadata,
  ): Prisma.JsonObject | undefined {
    const merged = {
      ...(metadata.sourceMetadata ?? {}),
      ...(metadata.source_metadata ?? {}),
    };
    return Object.keys(merged).length > 0
      ? (merged as Prisma.JsonObject)
      : undefined;
  }

  private async verifyInstantUploadFile(fileUrl: string): Promise<void> {
    try {
      const fileExists = await fs.pathExists(fileUrl);
      if (!fileExists) {
        this.logger.warn(`秒传文件不存在: ${fileUrl}`);
      }
    } catch (error) {
      this.logger.error(
        `检查秒传文件存在性失败: ${this.getErrorMessage(error)}`,
      );
    }
  }

  /**
   * 清理过期数据
   */
  private async cleanupExpiredData() {
    try {
      const now = Date.now();

      // 清理MD5缓存
      for (const [key, value] of this.md5Cache.entries()) {
        if (now - value.timestamp > PERFORMANCE_CONFIG.CACHE_TTL) {
          this.md5Cache.delete(key);
        }
      }

      // 清理过期的上传记录
      await this.prisma.upload.deleteMany({
        where: {
          status: UploadStatus.EXPIRED,
          expires_at: {
            lt: new Date(),
          },
        },
      });

      // 清理孤立的分片文件
      await this.cleanupOrphanedChunks();
    } catch (error) {
      this.logger.error('清理过期数据失败:', error);
    }
  }

  /**
   * 清理孤立的分片文件
   */
  private async cleanupOrphanedChunks() {
    try {
      const chunkDirs = await fs.readdir(this.chunkDir);

      for (const dir of chunkDirs) {
        const dirPath = path.join(this.chunkDir, dir);
        const stat = await fs.stat(dirPath);

        if (stat.isDirectory()) {
          // 检查是否存在对应的上传记录
          const upload = await this.prisma.upload.findUnique({
            where: { id: dir },
          });

          if (
            !upload ||
            upload.status === UploadStatus.COMPLETED ||
            upload.status === UploadStatus.FAILED
          ) {
            // 删除孤立的分片目录
            await fs.remove(dirPath);
            this.logger.log(`清理孤立分片目录: ${dir}`);
          }
        }
      }
    } catch (error) {
      this.logger.error('清理孤立分片失败:', error);
    }
  }

  /**
   * 计算文件MD5 - 优化版本
   */
  private async calculateFileMd5(filePath: string): Promise<string> {
    // 检查缓存
    const cacheKey = `${filePath}:${(await fs.stat(filePath)).mtime.getTime()}`;
    const cached = this.md5Cache.get(cacheKey);
    if (
      cached &&
      Date.now() - cached.timestamp < PERFORMANCE_CONFIG.CACHE_TTL
    ) {
      return cached.md5;
    }

    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('md5');
      const stream = fs.createReadStream(filePath, {
        highWaterMark: PERFORMANCE_CONFIG.CHUNK_MERGE_BUFFER_SIZE,
      });

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => {
        const md5 = hash.digest('hex');
        // 缓存结果
        this.md5Cache.set(cacheKey, { md5, timestamp: Date.now() });
        resolve(md5);
      });
      stream.on('error', reject);
    });
  }

  /**
   * 初始化上传 - 优化版本
   */
  async initUpload(
    dto: InitUploadDto,
    userId: number,
    userRole?: string,
  ): Promise<InitUploadResponse> {
    this.logger.log(
      `初始化上传: ${dto.filename}, MD5: ${dto.fileMd5}, userid: ${userId}`,
    );
    const uploadSource = this.resolveUserUploadSource(userRole);

    if (dto.fileType === FileType.VIDEO) {
      this.ensureVideoFeatureEnabled('视频上传');
    }

    // 检查并发限制
    if (this.activeUploads.size >= PERFORMANCE_CONFIG.MAX_CONCURRENT_UPLOADS) {
      throw new BadRequestException('当前上传任务过多，请稍后再试');
    }

    // 检查是否可以秒传
    const existingMedia = await this.checkInstantUpload(dto.fileMd5);
    if (existingMedia) {
      this.logger.log(`文件已存在，执行秒传: ${existingMedia.id}`);

      // 检查是否已有该用户对这个文件的上传记录
      const existingUploadRecord = await this.prisma.upload.findFirst({
        where: {
          file_md5: dto.fileMd5,
          user_id: userId,
          status: UploadStatus.COMPLETED,
          media_id: existingMedia.id,
        },
      });

      if (existingUploadRecord) {
        return {
          uploadId: existingUploadRecord.id,
          needUpload: false,
          uploadedChunks: [],
          mediaId: existingMedia.id,
        };
      }

      // 为秒传创建一个已完成的上传记录
      const chunkSize = dto.chunkSize || 5 * 1024 * 1024;
      const totalChunks = Math.ceil(dto.fileSize / chunkSize);

      const upload = await this.prisma.upload.create({
        data: {
          filename: dto.filename,
          file_size: dto.fileSize,
          file_type: dto.fileType,
          file_md5: dto.fileMd5,
          chunk_size: chunkSize,
          total_chunks: totalChunks,
          uploaded_chunks: Array.from({ length: totalChunks }, (_, i) => i),
          status: UploadStatus.COMPLETED,
          user_id: userId,
          metadata: {
            title: dto.title,
            description: dto.description,
            tagIds: dto.tagIds || [],
            tagNames: dto.tagNames || [],
            categoryId: dto.categoryId,
            source: uploadSource,
          },
          final_path: existingMedia.url,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      return {
        uploadId: upload.id,
        needUpload: false,
        uploadedChunks: [],
        mediaId: existingMedia.id,
      };
    }

    // 检查是否有未完成的上传
    const existingUpload = await this.prisma.upload.findFirst({
      where: {
        file_md5: dto.fileMd5,
        user_id: userId,
        status: { in: [UploadStatus.PENDING, UploadStatus.UPLOADING] },
      },
    });

    if (existingUpload) {
      this.logger.log(`发现未完成的上传，执行断点续传: ${existingUpload.id}`);
      const uploadedChunks = existingUpload.uploaded_chunks as number[];
      return {
        uploadId: existingUpload.id,
        needUpload: true,
        uploadedChunks,
      };
    }

    // 创建新的上传记录
    const chunkSize = dto.chunkSize || 5 * 1024 * 1024;
    const totalChunks = Math.ceil(dto.fileSize / chunkSize);

    const upload = await this.prisma.upload.create({
      data: {
        filename: dto.filename,
        file_size: dto.fileSize,
        file_type: dto.fileType,
        file_md5: dto.fileMd5,
        chunk_size: chunkSize,
        total_chunks: totalChunks,
        uploaded_chunks: [],
        status: UploadStatus.PENDING,
        user_id: userId,
        metadata: {
          title: dto.title,
          description: dto.description,
          tagIds: dto.tagIds || [],
          tagNames: dto.tagNames || [],
          categoryId: dto.categoryId,
          source: uploadSource,
        },
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // 创建分片目录
    const uploadChunkDir = path.join(this.chunkDir, upload.id);
    await fs.ensureDir(uploadChunkDir);

    // 添加到活跃上传集合
    this.activeUploads.add(upload.id);

    return {
      uploadId: upload.id,
      needUpload: true,
      uploadedChunks: [],
    };
  }

  /**
   * 检查是否可以秒传 - 优化版本
   */
  private async checkInstantUpload(fileMd5: string) {
    // 使用索引优化的查询
    const completedUpload = await this.prisma.upload.findFirst({
      where: {
        file_md5: fileMd5,
        status: UploadStatus.COMPLETED,
        media: { isNot: null },
      },
      include: {
        media: {
          select: {
            id: true,
            url: true,
          },
        },
      },
      orderBy: { created_at: 'desc' }, // 获取最新的记录
    });

    if (completedUpload && completedUpload.media) {
      const media = completedUpload.media;

      // 异步检查文件是否存在，不阻塞主流程
      setImmediate(() => {
        void this.verifyInstantUploadFile(media.url);
      });

      return media;
    }

    return null;
  }

  /**
   * 上传分片 - 优化版本
   */
  async uploadChunk(
    dto: UploadChunkDto,
    file: Express.Multer.File,
    userId: number,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(
      `上传分片: uploadId=${dto.uploadId}, chunk=${dto.chunkIndex}`,
    );

    // 验证上传记录
    const upload = await this.prisma.upload.findFirst({
      where: {
        id: dto.uploadId,
        user_id: userId,
        status: { in: [UploadStatus.PENDING, UploadStatus.UPLOADING] },
      },
      select: {
        id: true,
        total_chunks: true,
        uploaded_chunks: true,
      },
    });

    if (!upload) {
      throw new NotFoundException('上传记录不存在或已过期');
    }

    // 验证分片索引
    if (
      dto.chunkIndex >= dto.totalChunks ||
      dto.totalChunks !== upload.total_chunks
    ) {
      throw new BadRequestException('分片参数错误');
    }

    // 保存分片文件
    const uploadChunkDir = path.join(this.chunkDir, upload.id);
    const chunkPath = path.join(uploadChunkDir, `chunk-${dto.chunkIndex}`);

    try {
      await fs.move(file.path, chunkPath, { overwrite: true });
    } catch (error) {
      this.logger.error(`保存分片失败: ${this.getErrorMessage(error)}`);
      throw new InternalServerErrorException('保存分片失败');
    }

    // 更新已上传的分片列表 - 使用原子操作
    const uploadedChunks = upload.uploaded_chunks as number[];
    if (!uploadedChunks.includes(dto.chunkIndex)) {
      uploadedChunks.push(dto.chunkIndex);
      uploadedChunks.sort((a, b) => a - b);

      await this.prisma.upload.update({
        where: { id: upload.id },
        data: {
          uploaded_chunks: uploadedChunks,
          status: UploadStatus.UPLOADING,
        },
      });
    }

    return {
      success: true,
      message: `分片 ${dto.chunkIndex} 上传成功`,
    };
  }

  /**
   * 合并分片 - 优化版本
   */
  async mergeChunks(
    dto: MergeChunksDto,
    userId: number,
  ): Promise<{ mediaId: string }> {
    this.logger.log(`开始合并分片: ${dto.uploadId}`);

    // 获取上传记录
    const upload = await this.prisma.upload.findFirst({
      where: {
        id: dto.uploadId,
        user_id: userId,
        file_md5: dto.fileMd5,
      },
    });

    if (!upload) {
      throw new NotFoundException('上传记录不存在');
    }

    if (this.resolveStoredFileType(upload.file_type) === FileType.VIDEO) {
      this.ensureVideoFeatureEnabled('视频上传');
    }

    // 检查所有分片是否已上传
    const uploadedChunks = upload.uploaded_chunks as number[];
    if (uploadedChunks.length !== upload.total_chunks) {
      throw new BadRequestException('分片未全部上传完成');
    }

    // 更新状态为合并中
    await this.prisma.upload.update({
      where: { id: upload.id },
      data: { status: UploadStatus.MERGING },
    });

    try {
      // 生成最终文件路径
      const ext = path.extname(upload.filename);
      const finalFilename = `${upload.file_md5}${ext}`;
      const finalPath = path.join(
        this.uploadDir,
        upload.file_type,
        finalFilename,
      );
      await fs.ensureDir(path.dirname(finalPath));

      // 优化的分片合并
      const uploadChunkDir = path.join(this.chunkDir, upload.id);
      await this.mergeChunksOptimized(
        uploadChunkDir,
        finalPath,
        upload.total_chunks,
      );

      // 验证文件MD5
      const fileMd5 = await this.calculateFileMd5(finalPath);
      if (fileMd5 !== upload.file_md5) {
        await fs.remove(finalPath);
        throw new Error('文件MD5校验失败');
      }

      // 创建媒体记录
      const metadata = this.parseUploadMetadata(upload.metadata);
      const resolvedSource = this.resolveMetadataSource(metadata);
      const sourceMetadataValue: Prisma.JsonObject =
        this.mergeSourceMetadata(metadata) ?? {};
      const lowerExt = ext.toLowerCase();
      const resolvedFileType = this.resolveStoredFileType(upload.file_type);

      if (resolvedFileType === FileType.VIDEO && lowerExt === '.mov') {
        sourceMetadataValue.original_file_url = finalPath;
        sourceMetadataValue.original_file_format = 'mov';
      }
      const resolvedSourceMetadata =
        Object.keys(sourceMetadataValue).length > 0
          ? sourceMetadataValue
          : undefined;

      // 处理标签：将标签名称转换为标签ID
      let tagIds: string[] = [];
      const rawTagNames = metadata.tagNames ?? [];
      const rawTagIds = metadata.tagIds ?? [];
      if (rawTagNames.length > 0 || rawTagIds.length > 0) {
        tagIds = await this.resolveUploadTagIds({
          tagNames: rawTagNames,
          tagIds: rawTagIds,
          source: resolvedSource,
          creatorId: userId,
        });
      }

      // 提取图片尺寸信息
      let width: number | undefined;
      let height: number | undefined;
      if (resolvedFileType === FileType.IMAGE) {
        try {
          const imageMetadata = await sharp(finalPath).metadata();
          width = imageMetadata.width;
          height = imageMetadata.height;
        } catch (error) {
          this.logger.warn(
            `提取图片尺寸信息失败: ${this.getErrorMessage(error)}`,
          );
        }
      }

      const mediaTitle = metadata.title ?? upload.filename;
      const media = await this.mediaService.create({
        title: mediaTitle,
        description: metadata.description,
        url: finalPath,
        size: Number(upload.file_size),
        width,
        height,
        media_type:
          resolvedFileType === FileType.IMAGE
            ? MediaType.IMAGE
            : MediaType.VIDEO,
        user_id: userId,
        category_id: metadata.categoryId,
        tag_ids: tagIds,
        source: resolvedSource,
        source_metadata: resolvedSourceMetadata,
      });

      if (!media) {
        throw new Error('创建媒体记录失败');
      }

      // 更新上传记录
      await this.prisma.upload.update({
        where: { id: upload.id },
        data: {
          status: UploadStatus.COMPLETED,
          final_path: finalPath,
          media_id: media.id,
        },
      });

      // 清理分片文件
      await fs.remove(uploadChunkDir);

      // 从活跃上传集合中移除
      this.activeUploads.delete(upload.id);

      this.logger.log(`文件合并成功: ${media.id}`);
      return { mediaId: media.id };
    } catch (error) {
      // 失败时更新状态
      await this.prisma.upload.update({
        where: { id: upload.id },
        data: { status: UploadStatus.FAILED },
      });

      this.activeUploads.delete(upload.id);
      throw error;
    }
  }

  /**
   * 优化的分片合并
   */
  private async mergeChunksOptimized(
    chunkDir: string,
    finalPath: string,
    totalChunks: number,
  ): Promise<void> {
    const writeStream = fs.createWriteStream(finalPath, {
      highWaterMark: PERFORMANCE_CONFIG.CHUNK_MERGE_BUFFER_SIZE,
    });

    try {
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(chunkDir, `chunk-${i}`);
        const readStream = fs.createReadStream(chunkPath, {
          highWaterMark: PERFORMANCE_CONFIG.CHUNK_MERGE_BUFFER_SIZE,
        });

        await new Promise<void>((resolve, reject) => {
          readStream.on('data', (chunk) => {
            if (!writeStream.write(chunk)) {
              readStream.pause();
              writeStream.once('drain', () => readStream.resume());
            }
          });

          readStream.on('end', () => resolve());
          readStream.on('error', reject);
        });
      }

      await new Promise<void>((resolve, reject) => {
        writeStream.end();
        writeStream.on('finish', () => resolve());
        writeStream.on('error', reject);
      });
    } catch (error) {
      writeStream.destroy();
      throw error;
    }
  }

  /**
   * 获取上传进度
   */
  async getUploadProgress(
    uploadId: string,
    userId: number,
  ): Promise<UploadProgressResponse> {
    const upload = await this.prisma.upload.findFirst({
      where: {
        id: uploadId,
        user_id: userId,
      },
    });

    if (!upload) {
      throw new NotFoundException('上传记录不存在');
    }

    const uploadedChunks = upload.uploaded_chunks as number[];
    const progress = Math.round(
      (uploadedChunks.length / upload.total_chunks) * 100,
    );

    let status: 'pending' | 'uploading' | 'completed' | 'failed';
    switch (upload.status) {
      case UploadStatus.PENDING:
        status = 'pending';
        break;
      case UploadStatus.UPLOADING:
      case UploadStatus.MERGING:
        status = 'uploading';
        break;
      case UploadStatus.COMPLETED:
        status = 'completed';
        break;
      default:
        status = 'failed';
    }

    return {
      uploadId: upload.id,
      uploadedChunks,
      progress,
      status,
    };
  }

  /**
   * 批量初始化上传
   */
  async batchInitUpload(
    files: InitUploadDto[],
    userId: number,
    userRole?: string,
  ): Promise<InitUploadResponse[]> {
    const results: InitUploadResponse[] = [];

    for (const file of files) {
      try {
        const result = await this.initUpload(file, userId, userRole);
        results.push(result);
      } catch (error) {
        this.logger.error(
          `批量上传初始化失败: ${file.filename}, ${this.getErrorMessage(error)}`,
        );
        // 继续处理其他文件
      }
    }

    return results;
  }

  /**
   * 取消上传
   */
  async cancelUpload(uploadId: string, userId: number): Promise<void> {
    const upload = await this.prisma.upload.findFirst({
      where: {
        id: uploadId,
        user_id: userId,
        status: { in: [UploadStatus.PENDING, UploadStatus.UPLOADING] },
      },
    });

    if (!upload) {
      throw new NotFoundException('上传记录不存在或已完成');
    }

    // 更新状态
    await this.prisma.upload.update({
      where: { id: upload.id },
      data: { status: UploadStatus.FAILED },
    });

    // 清理分片文件
    const uploadChunkDir = path.join(this.chunkDir, upload.id);
    await fs.remove(uploadChunkDir);
  }

  /**
   * 解析上传标签（兼容 tagNames/tagIds）
   */
  private async resolveUploadTagIds(params: {
    tagNames: string[];
    tagIds: string[];
    source: MediaSource;
    creatorId: number;
  }): Promise<string[]> {
    if (params.tagNames.length > 0) {
      return this.resolveTagIdsFromNames(
        params.tagNames,
        params.source,
        params.creatorId,
      );
    }

    if (params.tagIds.length === 0) {
      return [];
    }

    const allUuid = params.tagIds.every((id) => this.isUuid(id));
    if (allUuid) {
      const tags = await this.prisma.tag.findMany({
        where: { id: { in: params.tagIds }, status: TagStatus.ACTIVE },
        select: { id: true },
      });
      return tags.map((tag) => tag.id);
    }

    return this.resolveTagIdsFromNames(
      params.tagIds,
      params.source,
      params.creatorId,
    );
  }

  private async resolveTagIdsFromNames(
    tagNames: string[],
    source: MediaSource,
    creatorId: number,
  ): Promise<string[]> {
    const tagIds: string[] = [];
    const { tagSource, creatorType } = this.resolveTagSource(source);

    for (const rawName of tagNames) {
      const displayName = rawName.trim().replace(/\s+/g, ' ');
      const normalizedName = this.normalizeTagName(displayName);
      if (!normalizedName) {
        continue;
      }

      let tag = await this.prisma.tag.findUnique({
        where: { normalized_name: normalizedName },
      });

      if (tag?.status === TagStatus.BLOCKED) {
        this.logger.warn(`跳过被禁用标签: ${displayName}`);
        continue;
      }

      if (!tag) {
        try {
          tag = await this.prisma.tag.create({
            data: {
              name: displayName,
              normalized_name: normalizedName,
              source: tagSource,
              status: TagStatus.ACTIVE,
              created_by_id: creatorId,
              created_by_type: creatorType,
            },
          });
          this.logger.log(`创建新标签: ${displayName}`);
        } catch (error) {
          const prismaError = error as { code?: string };
          if (prismaError.code === 'P2002') {
            tag = await this.prisma.tag.findUnique({
              where: { normalized_name: normalizedName },
            });
          }
          if (!tag || tag.status === TagStatus.BLOCKED) {
            this.logger.error(`创建标签失败: ${displayName}`, error);
            continue;
          }
        }
      }

      tagIds.push(tag.id);
    }

    return tagIds;
  }

  private normalizeTagName(name: string): string {
    return name.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  private resolveTagSource(source: MediaSource): {
    tagSource: TagSource;
    creatorType: TagCreatorType;
  } {
    if (source === MediaSource.USER_UPLOAD) {
      return { tagSource: TagSource.USER, creatorType: TagCreatorType.USER };
    }
    return { tagSource: TagSource.ADMIN, creatorType: TagCreatorType.ADMIN };
  }

  private resolveUserUploadSource(userRole?: string): MediaSource {
    return userRole === 'ADMIN'
      ? MediaSource.ADMIN_UPLOAD
      : MediaSource.USER_UPLOAD;
  }

  private resolveMetadataSource(metadata?: UploadMetadata): MediaSource {
    return metadata?.source ?? MediaSource.USER_UPLOAD;
  }

  private resolveStoredFileType(value: string): FileType {
    const isValidType = (Object.values(FileType) as string[]).includes(value);
    if (isValidType) {
      return value as FileType;
    }
    this.logger.warn(`未知文件类型，默认按视频处理: ${value}`);
    return FileType.VIDEO;
  }

  /**
   * 清理过期的上传记录
   */
  async cleanupExpiredUploads(): Promise<void> {
    this.logger.log('开始清理过期的上传记录');

    const expiredUploads = await this.prisma.upload.findMany({
      where: {
        expires_at: { lt: new Date() },
        status: { in: [UploadStatus.PENDING, UploadStatus.UPLOADING] },
      },
    });

    for (const upload of expiredUploads) {
      try {
        // 清理分片文件
        const uploadChunkDir = path.join(this.chunkDir, upload.id);
        await fs.remove(uploadChunkDir);

        // 更新状态
        await this.prisma.upload.update({
          where: { id: upload.id },
          data: { status: UploadStatus.EXPIRED },
        });
      } catch (error) {
        this.logger.error(
          `清理过期上传失败: ${upload.id}, ${this.getErrorMessage(error)}`,
        );
      }
    }

    this.logger.log(`清理了 ${expiredUploads.length} 个过期的上传记录`);
  }

  /**
   * 扫描系统导入目录
   */
  async scanSystemIngestDirectory(
    customPath?: string,
  ): Promise<SystemIngestScanResult> {
    this.logger.log('开始扫描系统导入目录...');

    // 使用用户指定的路径或默认路径
    const systemIngestBasePath =
      customPath || path.join(process.cwd(), 'scripts/system-ingest');

    // 安全检查：防止目录遍历攻击
    if (customPath && (customPath.includes('..') || customPath.includes('~'))) {
      throw new Error('无效的路径：不允许使用相对路径');
    }

    if (!(await fs.pathExists(systemIngestBasePath))) {
      if (!customPath) {
        await fs.ensureDir(systemIngestBasePath);
        this.logger.log(
          `系统导入默认目录不存在，已自动创建: ${systemIngestBasePath}`,
        );
      } else {
        throw new Error(`系统导入目录不存在: ${systemIngestBasePath}`);
      }
    }

    const users: SystemIngestUser[] = [];
    let totalFiles = 0;
    let totalSize = 0;

    try {
      const userDirs = await fs.readdir(systemIngestBasePath);

      for (const userDir of userDirs) {
        if (userDir.startsWith('.')) continue;

        const userPath = path.join(systemIngestBasePath, userDir);
        const stat = await fs.stat(userPath);

        if (stat.isDirectory()) {
          const userFiles = await this.scanUserDirectory(userPath, userDir);
          if (userFiles.length > 0) {
            users.push({
              userId: userDir,
              userName: userDir,
              totalFiles: userFiles.length,
              files: userFiles,
            });

            totalFiles += userFiles.length;
            totalSize += userFiles.reduce((sum, file) => sum + file.size, 0);
          }
        }
      }

      this.logger.log(
        `扫描完成: 共找到 ${users.length} 个用户，${totalFiles} 个文件`,
      );

      return {
        users,
        totalFiles,
        totalSize,
      };
    } catch (error) {
      this.logger.error(`扫描系统导入目录失败: ${this.getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * 扫描用户目录
   */
  private async scanUserDirectory(
    userPath: string,
    userId: string,
  ): Promise<SystemIngestFile[]> {
    const files: SystemIngestFile[] = [];

    try {
      const entries = await fs.readdir(userPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile()) {
          const filePath = path.join(userPath, entry.name);
          const fileInfo = await this.getSystemIngestFileInfo(
            filePath,
            entry.name,
          );

          if (fileInfo) {
            const fileId = uuidv4();

            // 将文件信息添加到缓存中，用于安全预览
            this.systemIngestFileCache.set(fileId, {
              path: filePath,
              name: entry.name,
              type: fileInfo.type,
            });

            files.push({
              id: fileId,
              name: entry.name,
              path: filePath,
              size: fileInfo.size,
              type: fileInfo.type,
              lastModified: fileInfo.lastModified.toISOString(),
              dimensions: fileInfo.dimensions,
            });
          }
        } else if (entry.isDirectory()) {
          const subDirPath = path.join(userPath, entry.name);
          const subFiles = await this.scanUserDirectory(subDirPath, userId);
          files.push(...subFiles);
        }
      }
    } catch (error) {
      this.logger.error(
        `扫描用户目录 ${userId} 失败: ${this.getErrorMessage(error)}`,
      );
    }

    return files;
  }

  /**
   * 获取系统导入文件信息
   */
  private async getSystemIngestFileInfo(
    filePath: string,
    fileName: string,
  ): Promise<SystemIngestFileInfo | null> {
    try {
      const stat = await fs.stat(filePath);
      const ext = path.extname(fileName).toLowerCase();

      let type: SystemIngestFileType;
      if (['.jpg', '.jpeg', '.png', '.webp', '.bmp'].includes(ext)) {
        type = 'image';
      } else if (['.gif'].includes(ext)) {
        type = 'gif';
      } else if (['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext)) {
        type = 'video';
      } else {
        return null;
      }

      return {
        size: stat.size,
        type,
        lastModified: stat.mtime,
      };
    } catch (error) {
      this.logger.error(
        `获取文件信息失败 ${fileName}: ${this.getErrorMessage(error)}`,
      );
      return null;
    }
  }

  /**
   * 批量上传系统导入文件
   */
  async batchUploadSystemIngestFiles(
    selectedFiles: SystemIngestFileSelection[],
    userId: number,
  ): Promise<SystemIngestBatchResultItem[]> {
    this.logger.log(`开始批量上传 ${selectedFiles.length} 个文件`);

    const results: SystemIngestBatchResultItem[] = [];

    for (const fileEntry of selectedFiles) {
      let filePath: string | undefined;
      let fileName: string | undefined;
      try {
        filePath = typeof fileEntry === 'string' ? fileEntry : fileEntry.path;
        fileName =
          typeof fileEntry === 'string'
            ? path.basename(fileEntry)
            : fileEntry.name || path.basename(fileEntry.path);
        const fileInfo = await this.getSystemIngestFileInfo(filePath, fileName);

        if (!fileInfo) {
          results.push({
            filePath,
            success: false,
            error: '不支持的文件类型',
          });
          continue;
        }

        if (fileInfo.type === 'video' && !this.enableVideoFeature) {
          results.push({
            filePath,
            fileName,
            success: false,
            error: '视频导入已关闭，当前阶段仅开放图片功能',
          });
          continue;
        }

        // 解析系统导入元数据
        const ingestInfo = this.parseSystemIngestInfo(
          filePath,
          fileName,
          typeof fileEntry === 'string' ? undefined : fileEntry.userId,
        );

        // 读取文件内容
        const fileBuffer = await fs.readFile(filePath);
        const fileMd5 = crypto
          .createHash('md5')
          .update(fileBuffer)
          .digest('hex');

        // 创建上传任务（包含系统导入元数据）
        const uploadResult = await this.initSystemIngestUpload(
          {
            filename: fileName,
            fileSize: fileInfo.size,
            fileType:
              fileInfo.type === 'video' ? FileType.VIDEO : FileType.IMAGE,
            fileMd5,
            title: ingestInfo.title || fileName,
            description: ingestInfo.description || `系统导入文件: ${fileName}`,
            tagIds: [],
            ingestUserId: ingestInfo.ingestUserId,
            originalCreatedAt: ingestInfo.originalCreatedAt,
            sourceMetadata: ingestInfo.sourceMetadata,
          },
          userId,
        );

        results.push({
          filePath,
          fileName,
          uploadId: uploadResult.uploadId,
          success: true,
          needUpload: uploadResult.needUpload,
          mediaId: uploadResult.mediaId,
        });

        // 如果需要上传，直接上传文件
        if (uploadResult.needUpload) {
          await this.uploadSystemIngestFileDirectly(
            uploadResult.uploadId,
            fileBuffer,
            fileMd5,
            userId,
          );
        }
      } catch (error) {
        this.logger.error(
          `上传文件失败 ${filePath || '未知路径'}: ${this.getErrorMessage(error)}`,
        );
        results.push({
          filePath,
          success: false,
          error: this.getErrorMessage(error),
        });
      }
    }

    return results;
  }

  /**
   * 解析系统导入文件的元数据
   */
  private parseSystemIngestInfo(
    filePath: string,
    fileName: string,
    userHint?: string,
  ): SystemIngestParseResult {
    const pathParts = filePath.split(path.sep);

    // 识别可能的来源用户 ID（优先匹配纯数字目录）
    const ingestUserId =
      userHint || pathParts.find((part) => /^\d{5,}$/.test(part)) || null;

    // 从文件名中提取时间与来源内容 ID，文件名格式：20250618T_5178828026545249_1.jpg
    let originalCreatedAt: Date | null = null;
    let ingestContentId: string | null = null;

    const ingestFileMatch = fileName.match(/(\d{8})T_(\d+)_\d+\./);
    if (ingestFileMatch) {
      const dateStr = ingestFileMatch[1];
      ingestContentId = ingestFileMatch[2];

      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      originalCreatedAt = new Date(`${year}-${month}-${day}`);
    }

    // 根据真实目录命名判断媒体分类，兼容中文抓取目录。
    const normalizedFilePath = filePath.toLowerCase();
    const fileExtension = path.extname(fileName).toLowerCase();
    const isVideoFile = ['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(
      fileExtension,
    );
    const isImageFile = ['.jpg', '.jpeg', '.png', '.webp', '.bmp'].includes(
      fileExtension,
    );
    const isGifFile = fileExtension === '.gif';

    let mediaCategory = 'general';
    if (
      normalizedFilePath.includes('original') ||
      filePath.includes('原创') ||
      filePath.includes('原图')
    ) {
      mediaCategory = 'original';
    } else if (
      normalizedFilePath.includes('live_photo') ||
      normalizedFilePath.includes('live')
    ) {
      mediaCategory = 'live';
    } else if (normalizedFilePath.includes('video') || isVideoFile) {
      mediaCategory = 'video';
    } else if (isImageFile || isGifFile) {
      mediaCategory = 'image';
    }

    const sourceMetadata = {
      ingestUserId,
      ingestContentId,
      originalPath: filePath,
      sourcePipeline: 'system-ingest',
      mediaCategory,
      importedAt: new Date().toISOString(),
    };

    return {
      ingestUserId,
      originalCreatedAt,
      sourceMetadata,
      title: ingestUserId
        ? `系统导入用户 ${ingestUserId} 的 ${mediaCategory}`
        : fileName,
      description: `系统导入的${mediaCategory}: ${fileName}${
        ingestUserId ? ` (来源用户: ${ingestUserId})` : ''
      }${ingestContentId ? ` (来源ID: ${ingestContentId})` : ''}`,
    };
  }

  /**
   * 初始化系统导入上传
   */
  private async initSystemIngestUpload(
    dto: SystemIngestUploadRequest,
    userId: number,
  ): Promise<SystemIngestUploadInitResult> {
    try {
      if (dto.fileType === FileType.VIDEO) {
        this.ensureVideoFeatureEnabled('视频导入');
      }

      // 检查是否已存在相同文件
      const existingMedia = await this.checkInstantUpload(dto.fileMd5);
      if (existingMedia) {
        const existingUploadRecord = await this.prisma.upload.findFirst({
          where: {
            file_md5: dto.fileMd5,
            user_id: userId,
            status: UploadStatus.COMPLETED,
            media_id: existingMedia.id,
          },
        });

        if (existingUploadRecord) {
          return {
            uploadId: existingUploadRecord.id,
            needUpload: false,
            mediaId: existingMedia.id,
          };
        }

        const chunkSize = 5 * 1024 * 1024;
        const totalChunks = Math.ceil(dto.fileSize / chunkSize);
        const sourceMetadataValue = dto.sourceMetadata
          ? (dto.sourceMetadata as Prisma.JsonObject)
          : null;
        const metadataPayload: Prisma.InputJsonValue = {
          title: dto.title,
          description: dto.description,
          tagIds: dto.tagIds,
          source: MediaSource.SYSTEM_INGEST,
          originalCreatedAt: dto.originalCreatedAt ?? null,
          sourceMetadata: sourceMetadataValue,
          ingestUserId: dto.ingestUserId ?? null,
        };

        const upload = await this.prisma.upload.create({
          data: {
            filename: dto.filename,
            file_size: dto.fileSize,
            file_type: dto.fileType,
            file_md5: dto.fileMd5,
            chunk_size: chunkSize,
            total_chunks: totalChunks,
            uploaded_chunks: Array.from({ length: totalChunks }, (_, i) => i),
            status: UploadStatus.COMPLETED,
            metadata: metadataPayload,
            final_path: existingMedia.url,
            media_id: existingMedia.id,
            user_id: userId,
          },
        });

        return {
          uploadId: upload.id,
          needUpload: false,
          mediaId: existingMedia.id,
        };
      }

      // 创建上传记录
      const sourceMetadataValue = dto.sourceMetadata
        ? (dto.sourceMetadata as Prisma.JsonObject)
        : null;
      const metadataPayload: Prisma.InputJsonValue = {
        title: dto.title,
        description: dto.description,
        tagIds: dto.tagIds,
        source: MediaSource.SYSTEM_INGEST,
        originalCreatedAt: dto.originalCreatedAt ?? null,
        sourceMetadata: sourceMetadataValue,
        ingestUserId: dto.ingestUserId ?? null,
      };

      const upload = await this.prisma.upload.create({
        data: {
          filename: dto.filename,
          file_size: dto.fileSize,
          file_type: dto.fileType,
          file_md5: dto.fileMd5,
          chunk_size: 5 * 1024 * 1024, // 5MB
          total_chunks: Math.ceil(dto.fileSize / (5 * 1024 * 1024)),
          uploaded_chunks: [],
          status: UploadStatus.PENDING,
          metadata: metadataPayload,
          user_id: userId,
        },
      });

      return {
        uploadId: upload.id,
        needUpload: true,
        chunkSize: upload.chunk_size,
        totalChunks: upload.total_chunks,
      };
    } catch (error) {
      this.logger.error(
        `初始化系统导入上传失败: ${this.getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * 直接上传系统导入文件
   */
  private async uploadSystemIngestFileDirectly(
    uploadId: string,
    fileBuffer: Buffer,
    fileMd5: string,
    userId: number,
  ): Promise<void> {
    try {
      const chunkSize = 5 * 1024 * 1024; // 5MB
      const totalChunks = Math.ceil(fileBuffer.length / chunkSize);

      // 创建分片目录
      const uploadChunkDir = path.join(this.chunkDir, uploadId);
      await fs.ensureDir(uploadChunkDir);

      // 保存分片
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, fileBuffer.length);
        const chunk = fileBuffer.slice(start, end);

        const chunkPath = path.join(uploadChunkDir, `chunk-${i}`);
        await fs.writeFile(chunkPath, chunk);
      }

      // 更新上传状态
      await this.prisma.upload.update({
        where: { id: uploadId },
        data: {
          uploaded_chunks: Array.from({ length: totalChunks }, (_, i) => i),
          status: UploadStatus.UPLOADING,
        },
      });

      // 合并分片
      await this.mergeChunks({ uploadId, fileMd5 }, userId);
    } catch (error) {
      this.logger.error(`直接上传文件失败:`, error);
      throw error;
    }
  }

  /**
   * 预览系统导入文件（安全版本）
   */
  async previewSystemIngestFile(
    fileId: string,
    userId: number,
    res: Response,
  ): Promise<void> {
    try {
      // 验证fileId格式
      if (!fileId || typeof fileId !== 'string') {
        throw new Error('无效的文件ID');
      }

      // 从临时存储中获取文件信息
      const fileInfo = await this.getSystemIngestFileInfoForPreview(fileId);
      if (!fileInfo) {
        throw new Error('文件不存在或无权访问');
      }

      // 检查文件是否真实存在
      const fileExists = await fs.pathExists(fileInfo.path);
      if (!fileExists) {
        throw new Error('文件不存在');
      }

      // 检查响应是否已经发送
      if (res.headersSent) {
        this.logger.warn('响应头已发送，无法设置预览文件头部');
        return;
      }

      // 获取文件扩展名并设置Content-Type
      const ext = path.extname(fileInfo.path).toLowerCase();
      const contentType = this.getContentType(ext);

      // 设置响应头
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'max-age=3600'); // 1小时缓存
      res.setHeader('X-File-Name', fileInfo.name);

      // 创建文件流并发送
      const fileStream = fs.createReadStream(fileInfo.path);

      // 处理文件流错误
      fileStream.on('error', (error) => {
        this.logger.error('文件流读取错误:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: '文件读取失败' });
        }
      });

      fileStream.pipe(res);
    } catch (error) {
      this.logger.error('预览文件失败:', error);
      if (!res.headersSent) {
        res.status(404).json({ error: '文件预览失败' });
      }
    }
  }

  /**
   * 获取系统导入文件信息（用于预览）- 安全版本
   */
  private async getSystemIngestFileInfoForPreview(
    fileId: string,
  ): Promise<{ path: string; name: string } | null> {
    try {
      // 从内存缓存或数据库中获取文件信息
      // 这里使用一个更安全的方式：通过UUID映射到实际路径
      const fileInfo = this.systemIngestFileCache.get(fileId);
      if (!fileInfo) {
        this.logger.warn(`文件ID ${fileId} 不存在于缓存中`);
        return null;
      }

      // 验证用户权限（可选，根据业务需求）
      // 这里暂时跳过用户权限检查，因为系统导入文件预览不需要严格的用户隔离

      // 检查文件是否真实存在
      const fileExists = await fs.pathExists(fileInfo.path);
      if (!fileExists) {
        this.logger.warn(`文件 ${fileInfo.path} 不存在`);
        return null;
      }

      return {
        path: fileInfo.path,
        name: fileInfo.name,
      };
    } catch (error) {
      this.logger.error('获取文件信息失败:', error);
      return null;
    }
  }

  /**
   * 获取文件的MIME类型
   */
  private getContentType(ext: string): string {
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.webm': 'video/webm',
      '.mkv': 'video/x-matroska',
    };

    return mimeTypes[ext] ?? 'application/octet-stream';
  }
}
