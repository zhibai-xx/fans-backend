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
   * @param type 文件类型目录 (image/video等)
   * @param filename 文件名
   * @param res Express响应对象
   */
  @Get(':type/:filename')
  @Header('Cache-Control', 'max-age=2592000') // 30天缓存
  async serveFile(
    @Param('type') type: string,
    @Param('filename') filename: string,
    @Res() res: Response // 移除 passthrough，直接控制响应
  ): Promise<void> {
    console.log('📁 FileController.serveFile - 文件类型:', type, '文件名:', filename);

    try {
      // 构建相对路径
      const relativePath = `${type}/${filename}`;
      console.log('📂 相对路径:', relativePath);

      // 净化文件路径，防止目录遍历攻击
      const sanitizedPath = this.sanitizeFilePath(relativePath);
      console.log('🧹 净化后的路径:', sanitizedPath);

      // 构建文件的完整路径
      const filePath = join(this.uploadDir, sanitizedPath);
      console.log('📂 完整文件路径:', filePath);

      // 检查文件是否在上传目录内（安全检查）
      if (!this.isPathUnderUploadDir(filePath)) {
        console.log('❌ 安全检查失败 - 文件不在上传目录内');
        throw new NotFoundException('文件不存在或无法访问');
      }

      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        console.log('❌ 文件不存在:', filePath);
        throw new NotFoundException('文件不存在');
      }

      console.log('✅ 文件存在，开始提供服务');

      // 获取文件信息
      const stat = fs.statSync(filePath);

      // 设置正确的Content-Type和头部
      const contentType = this.getContentType(filePath);
      res.set({
        'Content-Type': contentType,
        'Content-Length': stat.size.toString(),
        'Content-Disposition': `inline; filename="${path.basename(filePath)}"`,
        'Cache-Control': 'max-age=2592000', // 30天缓存
      });

      // 创建文件流并直接pipe到响应
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);

    } catch (error) {
      console.log('💥 FileController 错误:', error.message);
      if (error instanceof NotFoundException) {
        res.status(404).json({
          statusCode: 404,
          message: error.message,
          error: 'Not Found'
        });
      } else {
        res.status(500).json({
          statusCode: 500,
          message: '文件访问失败',
          error: 'Internal Server Error'
        });
      }
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
   * 净化文件路径，防止目录遍历攻击
   * @param filePath 原始文件路径
   * @returns 安全的文件路径
   */
  private sanitizeFilePath(filePath: string): string {
    // 移除开头的斜杠
    let sanitized = filePath.startsWith('/') ? filePath.substring(1) : filePath;

    // 防止目录遍历攻击：移除 ../ 和 ..\ 
    sanitized = sanitized.replace(/\.\.[\/\\]/g, '');

    // 移除危险字符但保留正常的路径分隔符
    sanitized = sanitized.replace(/[?%*:|"<>]/g, '');

    return sanitized;
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