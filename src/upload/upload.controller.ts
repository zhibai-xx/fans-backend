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
import { Request } from 'express';

@ApiTags('upload')
@Controller('upload')
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(private readonly uploadService: UploadService) { }

  /**
   * 初始化上传
   */
  @Post('init')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ short: { limit: 20, ttl: 1000 }, long: { limit: 100, ttl: 60000 } })
  @ApiOperation({ summary: '初始化上传' })
  @ApiResponse({ status: 201, description: '初始化成功', type: InitUploadResponse })
  @ApiResponse({ status: 401, description: '未授权' })
  async initUpload(
    @Body() dto: InitUploadDto,
    @Req() req: Request,
  ): Promise<InitUploadResponse> {
    const userId = (req.user as any).id;
    this.logger.log(`用户 ${userId} 初始化上传: ${dto.filename}`);
    return this.uploadService.initUpload(dto, userId);
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
    @Req() req: Request,
  ): Promise<InitUploadResponse[]> {
    const userId = (req.user as any).id;
    this.logger.log(`用户 ${userId} 批量初始化上传: ${dto.files.length} 个文件`);
    return this.uploadService.batchInitUpload(dto.files, userId);
  }

  /**
   * 上传分片
   */
  @Post('chunk')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('chunk'))
  @Throttle({ short: { limit: 30, ttl: 1000 }, long: { limit: 200, ttl: 60000 } })
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
    @Body() body: any,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new Error('未找到上传文件');
    }

    // 手动构建和验证DTO，处理multipart数据的类型转换
    const dto: UploadChunkDto = {
      uploadId: body.uploadId,
      chunkIndex: parseInt(body.chunkIndex),
      totalChunks: parseInt(body.totalChunks),
    };

    // 基本验证
    if (!dto.uploadId || isNaN(dto.chunkIndex) || isNaN(dto.totalChunks)) {
      throw new Error('参数错误：uploadId、chunkIndex 和 totalChunks 都是必需的');
    }

    const userId = (req.user as any).id;
    this.logger.log(`用户 ${userId} 上传分片: uploadId=${dto.uploadId}, chunk=${dto.chunkIndex}`);

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
    @Req() req: Request,
  ) {
    const userId = (req.user as any).id;
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
  @ApiResponse({ status: 200, description: '获取成功', type: UploadProgressResponse })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 404, description: '上传记录不存在' })
  async getUploadProgress(
    @Param('uploadId') uploadId: string,
    @Req() req: Request,
  ): Promise<UploadProgressResponse> {
    const userId = (req.user as any).id;
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
    @Req() req: Request,
  ) {
    const userId = (req.user as any).id;
    this.logger.log(`用户 ${userId} 取消上传: ${uploadId}`);
    await this.uploadService.cancelUpload(uploadId, userId);
  }
}
