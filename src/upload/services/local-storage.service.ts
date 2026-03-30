import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IStorageService } from '../interfaces/storage.interface';
import * as fs from 'fs';
import * as path from 'path';
import * as sharp from 'sharp';
import { promises as fsPromises } from 'fs';
import { v4 as uuidv4 } from 'uuid';

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
export class LocalStorageService implements IStorageService {
  private readonly uploadDir: string;
  private readonly thumbnailDir: string;
  private readonly absoluteUploadDir: string;
  private readonly absoluteThumbnailDir: string;
  private readonly logger = new Logger(LocalStorageService.name);

  constructor(private configService: ConfigService) {
    // 获取上传目录配置
    this.uploadDir =
      this.configService.get<string>('UPLOAD_DIR') || './uploads';
    this.thumbnailDir = path.join(this.uploadDir, 'thumbnails');
    this.absoluteUploadDir = path.resolve(this.uploadDir);
    this.absoluteThumbnailDir = path.resolve(this.thumbnailDir);

    // 确保目录存在
    void this.ensureDirectoryExists(this.uploadDir);
    void this.ensureDirectoryExists(this.thumbnailDir);
  }

  /**
   * 确保目录存在，如果不存在则创建
   * @param directory 目录路径
   */
  private async ensureDirectoryExists(directory: string): Promise<void> {
    try {
      await fsPromises.access(path.resolve(directory), fs.constants.F_OK);
    } catch (_error) {
      void _error;
      await fsPromises.mkdir(path.resolve(directory), { recursive: true });
    }
  }

  /**
   * 上传文件到本地存储
   * @param file 文件对象
   * @param customPath 自定义路径
   * @returns 文件URL
   */
  async uploadFile(
    file: Express.Multer.File,
    customPath?: string,
  ): Promise<string> {
    // 确定存储目录
    const directory = customPath
      ? path.join(this.uploadDir, customPath)
      : this.uploadDir;

    // 确保目录存在
    await this.ensureDirectoryExists(directory);

    // 生成唯一文件名
    const fileExt = path.extname(file.originalname);
    const fileName = `${uuidv4()}${fileExt}`;
    const filePath = path.join(directory, fileName);

    // 写入文件
    await fsPromises.writeFile(filePath, file.buffer);

    // 计算相对于 uploads 目录的路径
    const relativePath = path.relative(this.uploadDir, filePath);

    // 返回可访问的URL路径
    return `/api/upload/file/${relativePath.replace(/\\/g, '/')}`;
  }

  /**
   * 删除本地存储文件
   * @param fileUrl 文件URL
   * @returns 是否删除成功
   */
  async deleteFile(fileUrl: string): Promise<boolean> {
    try {
      const filePath = this.resolveLocalFilePath(fileUrl);
      if (!filePath) {
        this.logger.warn(`本地删除失败，无法解析路径: ${fileUrl}`);
        return false;
      }

      // 检查文件是否存在
      await fsPromises.access(filePath, fs.constants.F_OK);

      // 删除文件
      await fsPromises.unlink(filePath);

      // 检查是否有对应的缩略图
      const thumbnailPath = path.join(
        this.absoluteThumbnailDir,
        path.basename(filePath),
      );
      try {
        await fsPromises.access(thumbnailPath, fs.constants.F_OK);
        await fsPromises.unlink(thumbnailPath);
      } catch (_error) {
        void _error;
        // 缩略图不存在，忽略错误
      }

      return true;
    } catch (error) {
      this.logger.error(
        `删除本地文件失败: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      return false;
    }
  }

  /**
   * 为图片生成缩略图
   * @param file 图片文件
   * @param originalUrl 原始图片的URL
   * @returns 缩略图URL
   */
  async generateThumbnail(
    file: Express.Multer.File,
    originalUrl?: string,
  ): Promise<string> {
    try {
      // 仅处理图片文件
      if (!file.mimetype.startsWith('image/')) {
        throw new Error('只支持图片文件生成缩略图');
      }

      // 确保缩略图目录存在
      await this.ensureDirectoryExists(this.thumbnailDir);

      // 从原始URL中提取文件名（如果提供）
      let fileName;
      if (originalUrl) {
        fileName = path.basename(originalUrl);
      } else {
        const fileExt = path.extname(file.originalname);
        fileName = `${uuidv4()}${fileExt}`;
      }

      // 生成缩略图文件名
      const thumbnailFileName = `thumb_${fileName}`;
      const thumbnailPath = path.join(this.thumbnailDir, thumbnailFileName);

      // 使用sharp生成缩略图
      await sharp(file.buffer)
        .resize(200, 200, { fit: 'inside' })
        .toFile(thumbnailPath);

      // 计算相对路径
      const relativePath = path.relative(this.uploadDir, thumbnailPath);

      // 返回缩略图URL
      return `/api/upload/file/${relativePath.replace(/\\/g, '/')}`;
    } catch (error) {
      this.logger.error(
        `生成缩略图失败: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      return '';
    }
  }

  private resolveLocalFilePath(fileUrl: string): string | null {
    if (!fileUrl) {
      return null;
    }

    let normalized = fileUrl.trim();
    if (!normalized) {
      return null;
    }

    try {
      const parsed = new URL(normalized, 'http://localhost');
      normalized = parsed.pathname || normalized;
    } catch {
      // 非绝对URL，忽略
    }

    normalized = decodeURIComponent(normalized);
    normalized = normalized.replace(/^\/+/, '');

    if (normalized.startsWith('api/upload/file/')) {
      normalized = normalized.substring('api/upload/file/'.length);
    } else if (normalized.startsWith('/api/upload/file/')) {
      normalized = normalized.substring('/api/upload/file/'.length);
    }

    if (normalized.startsWith('uploads/')) {
      normalized = normalized.substring('uploads/'.length);
    }

    const resolvedPath = path.resolve(this.absoluteUploadDir, normalized);

    if (!resolvedPath.startsWith(this.absoluteUploadDir)) {
      this.logger.warn(
        `拒绝删除上传目录之外的文件: ${resolvedPath} (来源: ${fileUrl})`,
      );
      return null;
    }

    return resolvedPath;
  }
}
