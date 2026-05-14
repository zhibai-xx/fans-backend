import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IStorageService } from '../interfaces/storage.interface';
import * as OSS from 'ali-oss';
import * as path from 'path';
import * as sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

type OssConfig = {
  region: string;
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  endpoint: string;
  cdnBaseUrl?: string;
  objectPrefix?: string;
};

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

const getOssConfig = (configService: ConfigService): OssConfig => {
  const config = configService.get<OssConfig>('oss');
  if (
    !config ||
    !config.region ||
    !config.accessKeyId ||
    !config.accessKeySecret ||
    !config.bucket ||
    !config.endpoint
  ) {
    throw new Error('OSS 配置缺失或不完整');
  }
  return config;
};

@Injectable()
export class OssStorageService implements IStorageService {
  private client: OSS | null = null;
  private bucket = '';
  private cdnBaseUrl = '';
  private objectPrefix = '';
  private readonly logger = new Logger(OssStorageService.name);

  constructor(private configService: ConfigService) {
    // 当 USE_OSS_STORAGE=false 时，服务仍会被 Nest 实例化。
    // 因此这里不能在构造阶段强制校验 OSS 配置，避免本地存储模式也启动失败。
  }

  /**
   * 将文件上传到OSS
   * @param file 文件对象
   * @param customPath 自定义路径
   * @returns 文件URL
   */
  async uploadFile(
    file: Express.Multer.File,
    customPath?: string,
  ): Promise<string> {
    try {
      const { client, cdnBaseUrl } = this.getClient();
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
      const ossPath = this.withObjectPrefix(`${directory}${fileName}`);

      // 上传到OSS
      const result = await client.put(ossPath, file.buffer);

      void cdnBaseUrl;
      void result;

      // Bucket 保持私有，前端统一访问应用内路径，由后端签名跳转到 OSS。
      return `/api/upload/file/${ossPath}`;
    } catch (error) {
      const message = getErrorMessage(error);
      this.logger.error(`上传文件到OSS失败: ${message}`, getErrorStack(error));
      throw new Error(`上传文件失败: ${message}`);
    }
  }

  /**
   * 从OSS删除文件
   * @param fileUrl 文件URL
   * @returns 是否删除成功
   */
  async deleteFile(fileUrl: string): Promise<boolean> {
    try {
      const { client } = this.getClient();
      // 从URL中提取文件路径
      const ossPath = this.getOssPathFromUrl(fileUrl);
      if (!ossPath) {
        throw new Error('无效的文件URL');
      }

      // 删除文件
      await client.delete(ossPath);

      // 尝试删除对应的缩略图（如果存在）
      try {
        const fileExt = path.extname(ossPath);
        const fileName = path.basename(ossPath, fileExt);
        const thumbnailPath = this.withObjectPrefix(
          `thumbnails/thumb_${fileName}${fileExt}`,
        );
        await client.delete(thumbnailPath);
      } catch (error) {
        // 缩略图可能不存在，忽略错误
        this.logger.debug(
          `删除缩略图失败或缩略图不存在: ${getErrorMessage(error)}`,
        );
      }

      return true;
    } catch (error) {
      this.logger.error(
        `从OSS删除文件失败: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      return false;
    }
  }

  /**
   * 生成图片缩略图并上传到OSS
   * @param file 图片文件
   * @param customPath 自定义路径
   * @returns 缩略图URL
   */
  async generateThumbnail(
    file: Express.Multer.File,
    originalUrl?: string,
  ): Promise<string> {
    void originalUrl;

    try {
      const { client, cdnBaseUrl } = this.getClient();
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
      const ossPath = this.withObjectPrefix(`thumbnails/${fileName}`);

      // 上传缩略图到OSS
      const result = await client.put(ossPath, thumbnailBuffer);

      void cdnBaseUrl;
      void result;

      return `/api/upload/file/${ossPath}`;
    } catch (error) {
      this.logger.error(
        `生成缩略图失败: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
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
      if (url.startsWith('/api/upload/file/')) {
        return url.substring('/api/upload/file/'.length);
      }

      if (url.startsWith('api/upload/file/')) {
        return url.substring('api/upload/file/'.length);
      }

      // 移除CDN基础URL
      if (url.startsWith(this.cdnBaseUrl)) {
        return url.substring(this.cdnBaseUrl.length + 1); // +1 是为了移除开头的斜杠
      }

      // 尝试解析URL
      const urlObj = new URL(url);
      if (urlObj.pathname.includes('/api/upload/file/')) {
        return urlObj.pathname.replace(/^.*\/api\/upload\/file\//, '');
      }

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
      this.logger.error(
        `解析URL失败: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      return ''; // 返回空字符串代替null
    }
  }

  getSignedUrl(
    fileUrl: string,
    expires = 300,
    response?: {
      'content-disposition'?: string;
      'content-type'?: string;
      'cache-control'?: string;
    },
  ): string {
    const { client } = this.getClient();
    const ossPath = this.getOssPathFromUrl(fileUrl);
    if (!ossPath) {
      throw new Error('无效的 OSS 文件路径');
    }

    return client.signatureUrl(ossPath, { expires, method: 'GET', response });
  }

  private getClient(): {
    client: OSS;
    bucket: string;
    cdnBaseUrl: string;
  } {
    if (this.client) {
      return {
        client: this.client,
        bucket: this.bucket,
        cdnBaseUrl: this.cdnBaseUrl,
      };
    }

    const ossConfig = getOssConfig(this.configService);
    this.client = new OSS({
      region: ossConfig.region,
      accessKeyId: ossConfig.accessKeyId,
      accessKeySecret: ossConfig.accessKeySecret,
      bucket: ossConfig.bucket,
      endpoint: ossConfig.endpoint,
    });
    this.bucket = ossConfig.bucket;
    this.objectPrefix = this.normalizeObjectPrefix(ossConfig.objectPrefix);
    this.cdnBaseUrl =
      ossConfig.cdnBaseUrl ||
      `https://${ossConfig.bucket}.${ossConfig.endpoint}`;

    return {
      client: this.client,
      bucket: this.bucket,
      cdnBaseUrl: this.cdnBaseUrl,
    };
  }

  private withObjectPrefix(ossPath: string): string {
    if (!this.objectPrefix) {
      return ossPath;
    }
    return `${this.objectPrefix}/${ossPath.replace(/^\/+/, '')}`;
  }

  private normalizeObjectPrefix(prefix?: string): string {
    if (!prefix) {
      return '';
    }
    return prefix.replace(/^\/+|\/+$/g, '').trim();
  }
}
