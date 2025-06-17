import * as path from 'path';
import * as crypto from 'crypto';

/**
 * 文件工具类，提供文件处理相关的工具函数
 */
export class FileUtils {
  /**
   * 获取文件扩展名
   * @param filename 文件名
   * @returns 扩展名（包含点，如 .jpg）
   */
  static getExtension(filename: string): string {
    return path.extname(filename).toLowerCase();
  }

  /**
   * 根据文件扩展名判断是否为图片
   * @param filename 文件名或扩展名
   * @returns 是否为图片
   */
  static isImage(filename: string): boolean {
    const ext = this.getExtension(filename);
    return ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext);
  }

  /**
   * 根据文件扩展名判断是否为视频
   * @param filename 文件名或扩展名
   * @returns 是否为视频
   */
  static isVideo(filename: string): boolean {
    const ext = this.getExtension(filename);
    return ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm'].includes(ext);
  }

  /**
   * 生成安全的文件名
   * @param originalName 原始文件名
   * @returns 安全的文件名
   */
  static getSafeFileName(originalName: string): string {
    const ext = this.getExtension(originalName);
    const timestamp = Date.now();
    const randomStr = crypto.randomBytes(8).toString('hex');
    return `${timestamp}-${randomStr}${ext}`;
  }

  /**
   * 根据MIME类型获取对应的文件扩展名
   * @param mimeType MIME类型
   * @returns 文件扩展名（包含点，如 .jpg）
   */
  static getExtensionFromMimeType(mimeType: string): string {
    const mimeMap = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'video/mp4': '.mp4',
      'video/quicktime': '.mov',
      'video/x-msvideo': '.avi',
      'video/webm': '.webm',
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    };

    return mimeMap[mimeType] || '.bin';
  }

  /**
   * 将字节大小转换为人类可读格式
   * @param bytes 字节数
   * @param decimals 小数位数
   * @returns 格式化的大小字符串（如 1.5 MB）
   */
  static formatFileSize(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
} 