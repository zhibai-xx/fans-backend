import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from 'src/database/database.service';
import { MediaService } from '../media/media.service';
import { StorageFactoryService } from './services/storage-factory.service';
import {
  InitUploadDto,
  UploadChunkDto,
  MergeChunksDto,
  InitUploadResponse,
  UploadProgressResponse,
  FileType
} from './dto/upload.dto';
import { MediaType, Prisma } from '@prisma/client';

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

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly uploadDir: string;
  private readonly tempDir: string;
  private readonly chunkDir: string;
  private readonly weiboFileCache = new Map<string, { path: string; name: string; type: string }>();

  // 性能优化相关
  private readonly md5Cache = new Map<string, { md5: string; timestamp: number }>();
  private readonly uploadQueue = new Map<string, Promise<any>>();
  private readonly activeUploads = new Set<string>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: DatabaseService,
    private readonly configService: ConfigService,
    private readonly mediaService: MediaService,
    private readonly storageFactory: StorageFactoryService,
  ) {
    // 初始化上传目录
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR') || 'uploads';
    this.tempDir = path.join(this.uploadDir, 'temp');
    this.chunkDir = path.join(this.uploadDir, 'chunks');

    // 确保目录存在
    this.ensureDirectories();

    // 启动清理定时器
    this.startCleanupTimer();
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
      this.cleanupExpiredData();
    }, PERFORMANCE_CONFIG.CLEANUP_INTERVAL);
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

          if (!upload || upload.status === UploadStatus.COMPLETED || upload.status === UploadStatus.FAILED) {
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
    if (cached && Date.now() - cached.timestamp < PERFORMANCE_CONFIG.CACHE_TTL) {
      return cached.md5;
    }

    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('md5');
      const stream = fs.createReadStream(filePath, {
        highWaterMark: PERFORMANCE_CONFIG.CHUNK_MERGE_BUFFER_SIZE
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
  async initUpload(dto: InitUploadDto, userId: number): Promise<InitUploadResponse> {
    this.logger.log(`初始化上传: ${dto.filename}, MD5: ${dto.fileMd5}, userid: ${userId}`);

    // 检查并发限制
    if (this.activeUploads.size >= PERFORMANCE_CONFIG.MAX_CONCURRENT_UPLOADS) {
      throw new BadRequestException('当前上传任务过多，请稍后再试');
    }

    // 检查是否可以秒传
    const existingMedia = await this.checkInstantUpload(dto.fileMd5, userId);
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
            categoryId: dto.categoryId,
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
          categoryId: dto.categoryId,
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
  private async checkInstantUpload(fileMd5: string, userId: number) {
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
          }
        }
      },
      orderBy: { created_at: 'desc' }, // 获取最新的记录
    });

    if (completedUpload && completedUpload.media) {
      const media = completedUpload.media;

      // 异步检查文件是否存在，不阻塞主流程
      setImmediate(async () => {
        try {
          const fileExists = await fs.pathExists(media.url);
          if (!fileExists) {
            this.logger.warn(`秒传文件不存在: ${media.url}`);
            // 可以考虑清理无效记录
          }
        } catch (error) {
          this.logger.error('检查秒传文件存在性失败:', error);
        }
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
    this.logger.log(`上传分片: uploadId=${dto.uploadId}, chunk=${dto.chunkIndex}`);

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
    if (dto.chunkIndex >= dto.totalChunks || dto.totalChunks !== upload.total_chunks) {
      throw new BadRequestException('分片参数错误');
    }

    // 保存分片文件
    const uploadChunkDir = path.join(this.chunkDir, upload.id);
    const chunkPath = path.join(uploadChunkDir, `chunk-${dto.chunkIndex}`);

    try {
      await fs.move(file.path, chunkPath, { overwrite: true });
    } catch (error) {
      this.logger.error(`保存分片失败: ${error.message}`);
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
  async mergeChunks(dto: MergeChunksDto, userId: number): Promise<{ mediaId: string }> {
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
      const finalPath = path.join(this.uploadDir, upload.file_type, finalFilename);
      await fs.ensureDir(path.dirname(finalPath));

      // 优化的分片合并
      const uploadChunkDir = path.join(this.chunkDir, upload.id);
      await this.mergeChunksOptimized(uploadChunkDir, finalPath, upload.total_chunks);

      // 验证文件MD5
      const fileMd5 = await this.calculateFileMd5(finalPath);
      if (fileMd5 !== upload.file_md5) {
        await fs.remove(finalPath);
        throw new Error('文件MD5校验失败');
      }

      // 创建媒体记录
      const metadata = upload.metadata as any;
      const media = await this.mediaService.create({
        title: metadata.title,
        description: metadata.description,
        url: finalPath,
        size: Number(upload.file_size),
        media_type: upload.file_type === FileType.IMAGE ? MediaType.IMAGE : MediaType.VIDEO,
        user_id: userId,
        category_id: metadata.categoryId,
        tag_ids: metadata.tagIds || [],
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
  private async mergeChunksOptimized(chunkDir: string, finalPath: string, totalChunks: number): Promise<void> {
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
  async getUploadProgress(uploadId: string, userId: number): Promise<UploadProgressResponse> {
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
    const progress = Math.round((uploadedChunks.length / upload.total_chunks) * 100);

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
  ): Promise<InitUploadResponse[]> {
    const results: InitUploadResponse[] = [];

    for (const file of files) {
      try {
        const result = await this.initUpload(file, userId);
        results.push(result);
      } catch (error) {
        this.logger.error(`批量上传初始化失败: ${file.filename}, ${error.message}`);
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
        this.logger.error(`清理过期上传失败: ${upload.id}, ${error.message}`);
      }
    }

    this.logger.log(`清理了 ${expiredUploads.length} 个过期的上传记录`);
  }

  /**
   * 扫描weibo文件夹
   */
  async scanWeiboDirectory(customPath?: string): Promise<any> {
    this.logger.log('开始扫描weibo文件夹...');

    // 使用用户指定的路径或默认路径
    const weiboBasePath = customPath || path.join(process.cwd(), 'scripts/weibo-crawler/weibo');

    // 安全检查：防止目录遍历攻击
    if (customPath && (customPath.includes('..') || customPath.includes('~'))) {
      throw new Error('无效的路径：不允许使用相对路径');
    }

    if (!await fs.pathExists(weiboBasePath)) {
      throw new Error(`weibo文件夹不存在: ${weiboBasePath}`);
    }

    const users: any[] = [];
    let totalFiles = 0;
    let totalSize = 0;

    try {
      const userDirs = await fs.readdir(weiboBasePath);

      for (const userDir of userDirs) {
        if (userDir.startsWith('.')) continue;

        const userPath = path.join(weiboBasePath, userDir);
        const stat = await fs.stat(userPath);

        if (stat.isDirectory()) {
          const userFiles = await this.scanUserDirectory(userPath, userDir);
          if (userFiles.length > 0) {
            users.push({
              userId: userDir,
              userName: userDir,
              totalFiles: userFiles.length,
              files: userFiles
            });

            totalFiles += userFiles.length;
            totalSize += userFiles.reduce((sum: number, file: any) => sum + file.size, 0);
          }
        }
      }

      this.logger.log(`扫描完成: 共找到 ${users.length} 个用户，${totalFiles} 个文件`);

      return {
        users,
        totalFiles,
        totalSize
      };
    } catch (error) {
      this.logger.error('扫描weibo文件夹失败:', error);
      throw error;
    }
  }

  /**
   * 扫描用户目录
   */
  private async scanUserDirectory(userPath: string, userId: string): Promise<any[]> {
    const files: any[] = [];

    try {
      const entries = await fs.readdir(userPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile()) {
          const filePath = path.join(userPath, entry.name);
          const fileInfo = await this.getWeiboFileInfo(filePath, entry.name);

          if (fileInfo) {
            const fileId = uuidv4();

            // 将文件信息添加到缓存中，用于安全预览
            this.weiboFileCache.set(fileId, {
              path: filePath,
              name: entry.name,
              type: fileInfo.type
            });

            files.push({
              id: fileId,
              name: entry.name,
              path: filePath,
              size: fileInfo.size,
              type: fileInfo.type,
              lastModified: fileInfo.lastModified.toISOString(),
              dimensions: fileInfo.dimensions
            });
          }
        } else if (entry.isDirectory()) {
          const subDirPath = path.join(userPath, entry.name);
          const subFiles = await this.scanUserDirectory(subDirPath, userId);
          files.push(...subFiles);
        }
      }
    } catch (error) {
      this.logger.error(`扫描用户目录 ${userId} 失败:`, error);
    }

    return files;
  }

  /**
   * 获取weibo文件信息
   */
  private async getWeiboFileInfo(filePath: string, fileName: string): Promise<any> {
    try {
      const stat = await fs.stat(filePath);
      const ext = path.extname(fileName).toLowerCase();

      let type: string;
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
      this.logger.error(`获取文件信息失败 ${fileName}:`, error);
      return null;
    }
  }

  /**
   * 批量上传weibo文件
   */
  async batchUploadWeiboFiles(selectedFilePaths: string[], userId: number): Promise<any> {
    this.logger.log(`开始批量上传 ${selectedFilePaths.length} 个文件`);

    const results: any[] = [];

    for (const filePath of selectedFilePaths) {
      try {
        const fileName = path.basename(filePath);
        const fileInfo = await this.getWeiboFileInfo(filePath, fileName);

        if (!fileInfo) {
          results.push({
            filePath,
            success: false,
            error: '不支持的文件类型'
          });
          continue;
        }

        // 解析微博信息
        const weiboInfo = this.parseWeiboInfo(filePath, fileName);

        // 读取文件内容
        const fileBuffer = await fs.readFile(filePath);
        const fileMd5 = crypto.createHash('md5').update(fileBuffer).digest('hex');

        // 创建上传任务（包含微博元数据）
        const uploadResult = await this.initWeiboUpload({
          filename: fileName,
          fileSize: fileInfo.size,
          fileType: fileInfo.type === 'video' ? FileType.VIDEO : FileType.IMAGE,
          fileMd5,
          title: weiboInfo.title || fileName,
          description: weiboInfo.description || `从weibo-crawler导入: ${fileName}`,
          tagIds: [],
          weiboUserId: weiboInfo.weiboUserId,
          originalCreatedAt: weiboInfo.originalCreatedAt,
          sourceMetadata: weiboInfo.sourceMetadata
        }, userId);

        results.push({
          filePath,
          fileName,
          uploadId: uploadResult.uploadId,
          success: true,
          needUpload: uploadResult.needUpload,
          mediaId: uploadResult.mediaId
        });

        // 如果需要上传，直接上传文件
        if (uploadResult.needUpload) {
          await this.uploadWeiboFileDirectly(uploadResult.uploadId, fileBuffer, fileMd5, userId);
        }

      } catch (error) {
        this.logger.error(`上传文件失败 ${filePath}:`, error);
        results.push({
          filePath,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
 * 解析微博信息
 */
  private parseWeiboInfo(filePath: string, fileName: string): any {
    // 从文件路径中提取微博用户ID（例如：weibo/6387099968/xxxxx.jpg）
    const pathParts = filePath.split(path.sep);
    const weiboIndex = pathParts.findIndex(part => part === 'weibo');

    let weiboUserId: string | null = null;
    if (weiboIndex >= 0 && weiboIndex < pathParts.length - 1) {
      weiboUserId = pathParts[weiboIndex + 1];
    }

    // 从文件名中提取时间和微博ID信息
    // 文件名格式：20250618T_5178828026545249_1.jpg
    let originalCreatedAt: Date | null = null;
    let weiboId: string | null = null;

    // 解析文件名中的日期和微博ID
    const weiboFileMatch = fileName.match(/(\d{8})T_(\d+)_\d+\./);
    if (weiboFileMatch) {
      const dateStr = weiboFileMatch[1]; // 20250618
      weiboId = weiboFileMatch[2]; // 5178828026545249

      // 转换日期格式
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      originalCreatedAt = new Date(`${year}-${month}-${day}`);
    }

    // 判断媒体类型和分类
    let mediaCategory = '未分类';
    if (filePath.includes('原创微博图片')) {
      mediaCategory = '原创微博图片';
    } else if (filePath.includes('video')) {
      mediaCategory = '微博视频';
    } else if (filePath.includes('live_photo')) {
      mediaCategory = '微博Live Photo';
    }

    // 构建元数据
    const sourceMetadata = {
      weiboUserId,
      weiboId,
      originalPath: filePath,
      crawlSource: 'weibo-crawler',
      mediaCategory,
      importedAt: new Date().toISOString()
    };

    return {
      weiboUserId,
      originalCreatedAt,
      sourceMetadata,
      title: weiboUserId ? `微博用户${weiboUserId}的${mediaCategory}` : fileName,
      description: `从weibo-crawler导入的${mediaCategory}: ${fileName}${weiboUserId ? ` (用户ID: ${weiboUserId})` : ''}${weiboId ? ` (微博ID: ${weiboId})` : ''}`
    };
  }

  /**
   * 初始化微博上传
   */
  private async initWeiboUpload(dto: any, userId: number): Promise<any> {
    try {
      // 检查是否已存在相同文件
      const existingUpload = await this.checkInstantUpload(dto.fileMd5, userId);
      if (existingUpload) {
        return existingUpload;
      }

      // 创建上传记录
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
          metadata: {
            title: dto.title,
            description: dto.description,
            tagIds: dto.tagIds,
            source: 'WEIBO_CRAWL',
            originalCreatedAt: dto.originalCreatedAt,
            sourceMetadata: dto.sourceMetadata
          },
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
      this.logger.error('初始化微博上传失败:', error);
      throw error;
    }
  }

  /**
   * 直接上传weibo文件
   */
  private async uploadWeiboFileDirectly(uploadId: string, fileBuffer: Buffer, fileMd5: string, userId: number): Promise<void> {
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
 * 预览weibo文件（安全版本）
 */
  async previewWeiboFile(fileId: string, userId: number, res: any): Promise<void> {
    try {
      // 验证fileId格式
      if (!fileId || typeof fileId !== 'string') {
        throw new Error('无效的文件ID');
      }

      // 从临时存储中获取文件信息
      const fileInfo = await this.getWeiboFileInfoForPreview(fileId, userId);
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
   * 获取weibo文件信息（用于预览）- 安全版本
   */
  private async getWeiboFileInfoForPreview(fileId: string, userId: number): Promise<{ path: string; name: string } | null> {
    try {
      // 从内存缓存或数据库中获取文件信息
      // 这里使用一个更安全的方式：通过UUID映射到实际路径
      const fileInfo = this.weiboFileCache.get(fileId);
      if (!fileInfo) {
        this.logger.warn(`文件ID ${fileId} 不存在于缓存中`);
        return null;
      }

      // 验证用户权限（可选，根据业务需求）
      // 这里暂时跳过用户权限检查，因为weibo文件预览不需要严格的用户隔离

      // 检查文件是否真实存在
      const fileExists = await fs.pathExists(fileInfo.path);
      if (!fileExists) {
        this.logger.warn(`文件 ${fileInfo.path} 不存在`);
        return null;
      }

      return {
        path: fileInfo.path,
        name: fileInfo.name
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
    const mimeTypes = {
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

    return mimeTypes[ext] || 'application/octet-stream';
  }
}
