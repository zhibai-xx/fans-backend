import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Param,
  Get,
  Delete,
  HttpCode,
  HttpStatus,
  Logger,
  Req,
  Res,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';
import { Throttle } from '@nestjs/throttler';
import { UploadService } from './upload.service';
import {
  InitUploadDto,
  UploadChunkDto,
  MergeChunksDto,
  BatchInitUploadDto,
  InitUploadResponse,
  UploadProgressResponse,
} from './dto/upload.dto';
import { Request, Response } from 'express';

type AuthenticatedRequest = Request & {
  user: {
    id: number;
    role?: string;
  };
};

type UploadChunkBody = {
  uploadId?: string;
  chunkIndex?: string;
  totalChunks?: string;
};

type SystemIngestFileSelection =
  | string
  | { path: string; name?: string; userId?: string };

type BatchUploadSystemIngestBody = {
  selectedFiles: SystemIngestFileSelection[];
};

@ApiTags('upload')
@Controller('upload')
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(private readonly uploadService: UploadService) {}

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return '未知错误';
  }

  /**
   * 初始化上传
   */
  @Post('init')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({
    short: { limit: 20, ttl: 1000 },
    long: { limit: 100, ttl: 60000 },
  })
  @ApiOperation({ summary: '初始化上传' })
  @ApiResponse({
    status: 201,
    description: '初始化成功',
    type: InitUploadResponse,
  })
  @ApiResponse({ status: 401, description: '未授权' })
  async initUpload(
    @Body() dto: InitUploadDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<InitUploadResponse> {
    const userId = req.user.id;
    const userRole = req.user.role;
    this.logger.log(`用户 ${userId} 初始化上传: ${dto.filename}`);
    return this.uploadService.initUpload(dto, userId, userRole);
  }

  /**
   * 批量初始化上传
   */
  @Post('batch-init')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '批量初始化上传' })
  @ApiResponse({ status: 201, description: '初始化成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  async batchInitUpload(
    @Body() dto: BatchInitUploadDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<InitUploadResponse[]> {
    const userId = req.user.id;
    const userRole = req.user.role;
    this.logger.log(
      `用户 ${userId} 批量初始化上传: ${dto.files.length} 个文件`,
    );
    return this.uploadService.batchInitUpload(dto.files, userId, userRole);
  }

  /**
   * 上传分片
   */
  @Post('chunk')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('chunk'))
  @Throttle({
    short: { limit: 30, ttl: 1000 },
    long: { limit: 200, ttl: 60000 },
  })
  @ApiOperation({ summary: '上传分片' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        chunk: {
          type: 'string',
          format: 'binary',
          description: '分片文件',
        },
        uploadId: {
          type: 'string',
          description: '上传ID',
        },
        chunkIndex: {
          type: 'number',
          description: '分片索引',
        },
        totalChunks: {
          type: 'number',
          description: '总分片数',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: '分片上传成功' })
  @ApiResponse({ status: 400, description: '参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 404, description: '上传记录不存在' })
  async uploadChunk(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadChunkBody,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!file) {
      throw new Error('未找到上传文件');
    }

    // 手动构建和验证DTO，处理multipart数据的类型转换
    const dto: UploadChunkDto = {
      uploadId: body.uploadId ?? '',
      chunkIndex: parseInt(body.chunkIndex ?? '', 10),
      totalChunks: parseInt(body.totalChunks ?? '', 10),
    };

    // 基本验证
    if (!dto.uploadId || isNaN(dto.chunkIndex) || isNaN(dto.totalChunks)) {
      throw new Error(
        '参数错误：uploadId、chunkIndex 和 totalChunks 都是必需的',
      );
    }

    const userId = req.user.id;
    this.logger.log(
      `用户 ${userId} 上传分片: uploadId=${dto.uploadId}, chunk=${dto.chunkIndex}`,
    );

    return this.uploadService.uploadChunk(dto, file, userId);
  }

  /**
   * 合并分片
   */
  @Post('merge')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '合并分片' })
  @ApiResponse({ status: 201, description: '合并成功' })
  @ApiResponse({ status: 400, description: '分片未全部上传' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 404, description: '上传记录不存在' })
  async mergeChunks(
    @Body() dto: MergeChunksDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    this.logger.log(`用户 ${userId} 请求合并分片: ${dto.uploadId}`);
    return this.uploadService.mergeChunks(dto, userId);
  }

  /**
   * 获取上传进度
   */
  @Get('progress/:uploadId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取上传进度' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: UploadProgressResponse,
  })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 404, description: '上传记录不存在' })
  async getUploadProgress(
    @Param('uploadId') uploadId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<UploadProgressResponse> {
    const userId = req.user.id;
    return this.uploadService.getUploadProgress(uploadId, userId);
  }

  /**
   * 取消上传
   */
  @Delete(':uploadId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '取消上传' })
  @ApiResponse({ status: 204, description: '取消成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 404, description: '上传记录不存在' })
  async cancelUpload(
    @Param('uploadId') uploadId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    this.logger.log(`用户 ${userId} 取消上传: ${uploadId}`);
    await this.uploadService.cancelUpload(uploadId, userId);
  }

  /**
   * 扫描系统导入目录（仅管理员）
   */
  @Post('system-ingest/scan')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '扫描系统导入目录中的媒体文件（仅管理员）' })
  @ApiResponse({ status: 200, description: '扫描成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '需要管理员权限' })
  async scanSystemIngestFiles(
    @Body() body: { customPath?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      this.logger.log(
        `管理员 ${userId} (${userRole}) 扫描系统导入目录: ${body.customPath || '默认路径'}`,
      );
      const result = await this.uploadService.scanSystemIngestDirectory(
        body.customPath,
      );
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`扫描系统导入目录失败: ${this.getErrorMessage(error)}`);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(this.getErrorMessage(error));
    }
  }

  /**
   * 预览系统导入文件（仅管理员）
   */
  @Get('system-ingest/preview/:fileId')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @ApiBearerAuth()
  @Throttle({
    short: { limit: 50, ttl: 1000 },
    long: { limit: 500, ttl: 60000 },
  })
  @ApiOperation({ summary: '预览系统导入文件（仅管理员）' })
  @ApiResponse({ status: 200, description: '预览成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '需要管理员权限' })
  async previewSystemIngestFile(
    @Param('fileId') fileId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      this.logger.log(
        `管理员 ${userId} (${userRole}) 预览系统导入文件: ${fileId}`,
      );

      await this.uploadService.previewSystemIngestFile(fileId, userId, res);
    } catch (error) {
      this.logger.error(`预览文件失败: ${this.getErrorMessage(error)}`);
      res.status(404).json({ error: '文件预览失败' });
    }
  }

  /**
   * 批量上传系统导入文件（仅管理员）
   */
  @Post('system-ingest/batch-upload')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '批量上传系统导入文件（仅管理员）' })
  @ApiResponse({ status: 200, description: '批量上传成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '需要管理员权限' })
  async batchUploadSystemIngestFiles(
    @Body()
    body: BatchUploadSystemIngestBody,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      this.logger.log(
        `管理员 ${userId} (${userRole}) 批量上传系统导入文件: ${body.selectedFiles.length} 个文件`,
      );
      const normalizedFiles = body.selectedFiles.map((file) =>
        typeof file === 'string'
          ? { path: file }
          : { path: file.path, name: file.name, userId: file.userId },
      );
      const result = await this.uploadService.batchUploadSystemIngestFiles(
        normalizedFiles,
        userId,
      );
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`批量上传失败: ${this.getErrorMessage(error)}`);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(this.getErrorMessage(error));
    }
  }
}
