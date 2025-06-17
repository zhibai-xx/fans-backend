import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IStorageService } from '../interfaces/storage.interface';
import * as OSS from 'ali-oss';
import * as path from 'path';
import * as sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OssStorageService implements IStorageService {
  private readonly client: OSS;
  private readonly bucket: string;
  private readonly cdnBaseUrl: string;
  private readonly logger = new Logger(OssStorageService.name);

  constructor(private configService: ConfigService) {
    const ossConfig = this.configService.get('oss');

    // 初始化OSS客户端
    this.client = new OSS({
      region: ossConfig.region,
      accessKeyId: ossConfig.accessKeyId,
      accessKeySecret: ossConfig.accessKeySecret,
      bucket: ossConfig.bucket,
      endpoint: ossConfig.endpoint,
    });

    this.bucket = ossConfig.bucket;
    this.cdnBaseUrl = ossConfig.cdnBaseUrl || `https://${ossConfig.bucket}.${ossConfig.endpoint}`;
  }

  /**
   * 将文件上传到OSS
   * @param file 文件对象
   * @param customPath 自定义路径
   * @returns 文件URL
   */
  async uploadFile(file: Express.Multer.File, customPath?: string): Promise<string> {
    try {
      // 确定文件类型并选择合适的目录
      const isImage = file.mimetype.startsWith('image/');
      const isVideo = file.mimetype.startsWith('video/');

      // 根据文件类型选择存储目录
      let directory = 'others/';
      if (isImage) {
        directory = 'images/';
      } else if (isVideo) {
        directory = 'videos/';
      }

      // 如果提供了自定义路径，使用自定义路径
      if (customPath) {
        directory = customPath.endsWith('/') ? customPath : `${customPath}/`;
      }

      // 生成唯一文件名
      const fileExt = path.extname(file.originalname);
      const fileName = `${uuidv4()}${fileExt}`;
      const ossPath = `${directory}${fileName}`;

      // 上传到OSS
      const result = await this.client.put(ossPath, file.buffer);

      // 返回可访问的URL
      return result.url || `${this.cdnBaseUrl}/${ossPath}`;
    } catch (error) {
      this.logger.error(`上传文件到OSS失败: ${error.message}`, error.stack);
      throw new Error(`上传文件失败: ${error.message}`);
    }
  }

  /**
   * 从OSS删除文件
   * @param fileUrl 文件URL
   * @returns 是否删除成功
   */
  async deleteFile(fileUrl: string): Promise<boolean> {
    try {
      // 从URL中提取文件路径
      const ossPath = this.getOssPathFromUrl(fileUrl);
      if (!ossPath) {
        throw new Error('无效的文件URL');
      }

      // 删除文件
      await this.client.delete(ossPath);

      // 尝试删除对应的缩略图（如果存在）
      try {
        const fileExt = path.extname(ossPath);
        const fileName = path.basename(ossPath, fileExt);
        const thumbnailPath = `thumbnails/thumb_${fileName}${fileExt}`;
        await this.client.delete(thumbnailPath);
      } catch (error) {
        // 缩略图可能不存在，忽略错误
        this.logger.debug(`删除缩略图失败或缩略图不存在: ${error.message}`);
      }

      return true;
    } catch (error) {
      this.logger.error(`从OSS删除文件失败: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * 生成图片缩略图并上传到OSS
   * @param file 图片文件
   * @param customPath 自定义路径
   * @returns 缩略图URL
   */
  async generateThumbnail(file: Express.Multer.File, customPath?: string): Promise<string> {
    try {
      // 仅处理图片文件
      if (!file.mimetype.startsWith('image/')) {
        this.logger.warn(`不支持为非图片文件生成缩略图: ${file.mimetype}`);
        return '';
      }

      // 使用sharp生成缩略图
      const thumbnailBuffer = await sharp(file.buffer)
        .resize(200, 200, { fit: 'inside' })
        .toBuffer();

      // 生成唯一文件名
      const fileExt = path.extname(file.originalname);
      const fileName = `thumb_${uuidv4()}${fileExt}`;
      const ossPath = `thumbnails/${fileName}`;

      // 上传缩略图到OSS
      const result = await this.client.put(ossPath, thumbnailBuffer);

      // 返回缩略图URL
      return result.url || `${this.cdnBaseUrl}/${ossPath}`;
    } catch (error) {
      this.logger.error(`生成缩略图失败: ${error.message}`, error.stack);
      return '';
    }
  }

  /**
   * 从URL中提取OSS对象路径
   * @param url 完整的URL
   * @returns OSS对象路径
   */
  private getOssPathFromUrl(url: string): string {
    try {
      // 移除CDN基础URL
      if (url.startsWith(this.cdnBaseUrl)) {
        return url.substring(this.cdnBaseUrl.length + 1); // +1 是为了移除开头的斜杠
      }

      // 尝试解析URL
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      // 移除第一个空元素（因为pathname以/开头）
      if (pathParts[0] === '') {
        pathParts.shift();
      }

      // 如果路径包含bucket名称，需要移除
      if (pathParts[0] === this.bucket) {
        pathParts.shift();
      }

      return pathParts.join('/');
    } catch (error) {
      this.logger.error(`解析URL失败: ${error.message}`, error.stack);
      return ''; // 返回空字符串代替null
    }
  }
} 