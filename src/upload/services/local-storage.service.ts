import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IStorageService } from '../interfaces/storage.interface';
import * as fs from 'fs';
import * as path from 'path';
import * as sharp from 'sharp';
import { promises as fsPromises } from 'fs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LocalStorageService implements IStorageService {
  private readonly uploadDir: string;
  private readonly thumbnailDir: string;

  constructor(private configService: ConfigService) {
    // 获取上传目录配置
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR') || './uploads';
    this.thumbnailDir = path.join(this.uploadDir, 'thumbnails');

    // 确保目录存在
    this.ensureDirectoryExists(this.uploadDir);
    this.ensureDirectoryExists(this.thumbnailDir);
  }

  /**
   * 确保目录存在，如果不存在则创建
   * @param directory 目录路径
   */
  private async ensureDirectoryExists(directory: string): Promise<void> {
    try {
      await fsPromises.access(directory, fs.constants.F_OK);
    } catch (error) {
      await fsPromises.mkdir(directory, { recursive: true });
    }
  }

  /**
   * 上传文件到本地存储
   * @param file 文件对象 
   * @param customPath 自定义路径
   * @returns 文件URL
   */
  async uploadFile(file: Express.Multer.File, customPath?: string): Promise<string> {
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
      // 从URL中提取文件路径
      const urlPath = fileUrl.replace('/api/upload/file/', '');
      const filePath = path.join(this.uploadDir, urlPath);

      // 检查文件是否存在
      await fsPromises.access(filePath, fs.constants.F_OK);

      // 删除文件
      await fsPromises.unlink(filePath);

      // 检查是否有对应的缩略图
      const thumbnailPath = path.join(this.thumbnailDir, path.basename(filePath));
      try {
        await fsPromises.access(thumbnailPath, fs.constants.F_OK);
        await fsPromises.unlink(thumbnailPath);
      } catch (error) {
        // 缩略图不存在，忽略错误
      }

      return true;
    } catch (error) {
      console.error('删除文件失败:', error);
      return false;
    }
  }

  /**
   * 为图片生成缩略图
   * @param file 图片文件
   * @param originalUrl 原始图片的URL
   * @returns 缩略图URL
   */
  async generateThumbnail(file: Express.Multer.File, originalUrl?: string): Promise<string> {
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
      console.error('生成缩略图失败:', error);
      return '';
    }
  }
} 