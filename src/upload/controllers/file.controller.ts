import {
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
  StreamableFile,
  Header
} from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { FileUtils } from '../utils/file.utils';

@Controller('upload/file')
export class FileController {
  private readonly uploadDir: string;

  constructor(private readonly configService: ConfigService) {
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR') || './uploads';
  }

  /**
   * 提供静态文件访问
   * 为了安全起见，防止目录遍历攻击，该方法包含额外的安全检查
   * 
   * @param filename 请求的文件名
   * @param res Express响应对象
   */
  @Get(':filename')
  @Header('Cache-Control', 'max-age=2592000') // 30天缓存
  async serveFile(
    @Param('filename') filename: string,
    @Res({ passthrough: true }) res: Response
  ): Promise<StreamableFile> {
    try {
      // 净化文件名，防止目录遍历攻击
      const sanitizedFilename = this.sanitizeFilename(filename);

      // 构建文件的完整路径
      const filePath = join(this.uploadDir, sanitizedFilename);

      // 检查文件是否在上传目录内（安全检查）
      if (!this.isPathUnderUploadDir(filePath)) {
        throw new NotFoundException('文件不存在或无法访问');
      }

      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        throw new NotFoundException('文件不存在');
      }

      // 获取文件信息
      const stat = fs.statSync(filePath);

      // 设置正确的Content-Type
      const contentType = this.getContentType(filePath);
      res.set({
        'Content-Type': contentType,
        'Content-Length': stat.size.toString(),
        'Content-Disposition': `inline; filename="${path.basename(filePath)}"`,
      });

      // 创建文件流
      const fileStream = fs.createReadStream(filePath);

      // 返回文件流
      return new StreamableFile(fileStream);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException('文件访问失败');
    }
  }

  /**
   * 获取文件的MIME类型
   * @param filePath 文件路径
   * @returns MIME类型
   */
  private getContentType(filePath: string): string {
    const extension = path.extname(filePath).toLowerCase();

    // 常见MIME类型映射
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.webm': 'video/webm',
      '.pdf': 'application/pdf',
    };

    return mimeTypes[extension] || 'application/octet-stream';
  }

  /**
   * 净化文件名，防止目录遍历攻击
   * @param filename 原始文件名
   * @returns 安全的文件名
   */
  private sanitizeFilename(filename: string): string {
    // 提取基本文件名并移除任何路径分隔符和特殊字符
    return filename.replace(/[\/\\?%*:|"<>]/g, '');
  }

  /**
   * 检查路径是否在上传目录内（防止目录遍历攻击）
   * @param filePath 文件路径
   * @returns 是否在上传目录内
   */
  private isPathUnderUploadDir(filePath: string): boolean {
    const resolvedPath = path.resolve(filePath);
    const resolvedUploadDir = path.resolve(this.uploadDir);
    return resolvedPath.startsWith(resolvedUploadDir);
  }
} 