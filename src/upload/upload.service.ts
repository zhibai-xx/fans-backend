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

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly uploadDir: string;
  private readonly tempDir: string;
  private readonly chunkDir: string;

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
  }

  /**
   * 确保上传目录存在
   */
  private async ensureDirectories() {
    await fs.ensureDir(this.uploadDir);
    await fs.ensureDir(this.tempDir);
    await fs.ensureDir(this.chunkDir);
  }

  /**
   * 初始化上传
   */
  async initUpload(dto: InitUploadDto, userId: number): Promise<InitUploadResponse> {
    this.logger.log(`初始化上传: ${dto.filename}, MD5: ${dto.fileMd5}, userid: ${userId}`);

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
        // 如果已有上传记录，直接返回
        return {
          uploadId: existingUploadRecord.id,
          needUpload: false,
          uploadedChunks: [],
          mediaId: existingMedia.id,
        };
      }

      // 为秒传创建一个已完成的上传记录（不设置media_id避免唯一约束冲突）
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
          uploaded_chunks: Array.from({ length: totalChunks }, (_, i) => i), // 所有分片都已完成
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
      // 断点续传
      this.logger.log(`发现未完成的上传，执行断点续传: ${existingUpload.id}`);
      const uploadedChunks = existingUpload.uploaded_chunks as number[];
      return {
        uploadId: existingUpload.id,
        needUpload: true,
        uploadedChunks,
      };
    }

    // 创建新的上传记录
    const chunkSize = dto.chunkSize || 5 * 1024 * 1024; // 默认5MB
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
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时后过期
      },
    });

    // 创建分片目录
    const uploadChunkDir = path.join(this.chunkDir, upload.id);
    await fs.ensureDir(uploadChunkDir);

    return {
      uploadId: upload.id,
      needUpload: true,
      uploadedChunks: [],
    };
  }

  /**
   * 检查是否可以秒传
   */
  private async checkInstantUpload(fileMd5: string, userId: number) {
    // 查找相同MD5的已完成上传
    const completedUpload = await this.prisma.upload.findFirst({
      where: {
        file_md5: fileMd5,
        status: UploadStatus.COMPLETED,
        media: { isNot: null },
      },
      include: { media: true },
    });

    if (completedUpload && completedUpload.media) {
      // 检查文件是否真实存在
      const fileExists = await fs.pathExists(completedUpload.media.url);
      if (fileExists) {
        return completedUpload.media;
      }
    }

    return null;
  }

  /**
   * 上传分片
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

    // 更新已上传的分片列表
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
   * 合并分片
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

      // 合并分片
      const uploadChunkDir = path.join(this.chunkDir, upload.id);
      const writeStream = fs.createWriteStream(finalPath);

      for (let i = 0; i < upload.total_chunks; i++) {
        const chunkPath = path.join(uploadChunkDir, `chunk-${i}`);
        const chunkData = await fs.readFile(chunkPath);
        writeStream.write(chunkData);
      }

      await new Promise<void>((resolve, reject) => {
        writeStream.end();
        writeStream.on('finish', () => resolve());
        writeStream.on('error', reject);
      });

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

      this.logger.log(`文件合并成功: ${media.id}`);
      return { mediaId: media.id };
    } catch (error) {
      this.logger.error(`合并分片失败: ${error.message}`);

      // 更新失败状态
      await this.prisma.upload.update({
        where: { id: upload.id },
        data: {
          status: UploadStatus.FAILED,
          error_message: error.message,
        },
      });

      throw new InternalServerErrorException('合并分片失败');
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
   * 计算文件MD5
   */
  private async calculateFileMd5(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('md5');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }
}
