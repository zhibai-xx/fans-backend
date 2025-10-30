import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  VideoProcessingService,
  VideoProcessingJob,
} from '../services/video-processing.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../auth/guards/admin-role.guard';
import { MyLoggerService } from '../../my-logger/my-logger.service';

export class SubmitProcessingJobDto {
  mediaId: string;
  inputPath: string;
  outputDir: string;
  userId: number;
  options?: {
    generateQualities?: string[];
    generateHLS?: boolean;
    generateThumbnails?: boolean;
    skipIfExists?: boolean;
  };
}

export class JobStatusResponseDto {
  id: string;
  status: string;
  progress: number;
  data?: any;
  result?: any;
  error?: string;
  createdAt: Date;
  processedAt?: Date;
  finishedAt?: Date;
}

/**
 * 视频处理控制器
 * 提供视频处理任务的管理接口
 */
@ApiTags('视频处理')
@Controller('video-processing')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class VideoProcessingController {
  private readonly logger = new MyLoggerService(VideoProcessingController.name);

  constructor(private videoProcessingService: VideoProcessingService) {}

  /**
   * 提交视频处理任务
   * @param dto 任务数据
   * @returns 任务ID
   */
  @Post('jobs')
  @ApiOperation({ summary: '提交视频处理任务' })
  @ApiResponse({
    status: 201,
    description: '任务提交成功',
    schema: {
      type: 'object',
      properties: {
        jobId: { type: 'string' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: '请求参数无效' })
  @ApiResponse({ status: 401, description: '未授权' })
  @HttpCode(HttpStatus.CREATED)
  async submitJob(@Body() dto: SubmitProcessingJobDto) {
    this.logger.log(`提交视频处理任务: ${dto.mediaId}`);

    const job: VideoProcessingJob = {
      mediaId: dto.mediaId,
      inputPath: dto.inputPath,
      outputDir: dto.outputDir,
      userId: dto.userId,
      options: dto.options,
    };

    const jobId = await this.videoProcessingService.submitProcessingJob(job);

    return {
      success: true,
      jobId,
      message: '视频处理任务已提交',
    };
  }

  /**
   * 获取任务状态
   * @param jobId 任务ID
   * @returns 任务状态信息
   */
  @Get('jobs/:jobId/status')
  @ApiOperation({ summary: '获取任务状态' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: JobStatusResponseDto,
  })
  @ApiResponse({ status: 404, description: '任务不存在' })
  async getJobStatus(
    @Param('jobId') jobId: string,
  ): Promise<JobStatusResponseDto> {
    this.logger.log(`获取任务状态: ${jobId}`);

    const status = await this.videoProcessingService.getJobStatus(jobId);

    if (status.status === 'not_found') {
      throw new Error('任务不存在');
    }

    return status;
  }

  /**
   * 取消任务
   * @param jobId 任务ID
   * @returns 取消结果
   */
  @Delete('jobs/:jobId')
  @ApiOperation({ summary: '取消任务' })
  @ApiResponse({
    status: 200,
    description: '取消成功',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: '任务不存在' })
  @HttpCode(HttpStatus.OK)
  async cancelJob(@Param('jobId') jobId: string) {
    this.logger.log(`取消任务: ${jobId}`);

    const success = await this.videoProcessingService.cancelJob(jobId);

    if (!success) {
      throw new Error('任务不存在或无法取消');
    }

    return {
      success: true,
      message: '任务已取消',
    };
  }

  /**
   * 清理处理文件（管理员专用）
   * @param mediaId 媒体ID
   * @returns 清理结果
   */
  @Delete('media/:mediaId/cleanup')
  @UseGuards(AdminRoleGuard)
  @ApiOperation({ summary: '清理处理文件（管理员专用）' })
  @ApiResponse({
    status: 200,
    description: '清理成功',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '需要管理员权限' })
  @HttpCode(HttpStatus.OK)
  async cleanupFiles(@Param('mediaId') mediaId: string) {
    this.logger.log(`清理处理文件: ${mediaId}`);

    await this.videoProcessingService.cleanupProcessingFiles(mediaId);

    return {
      success: true,
      message: '处理文件已清理',
    };
  }

  /**
   * 获取队列统计信息（管理员专用）
   * @returns 队列统计
   */
  @Get('stats')
  @UseGuards(AdminRoleGuard)
  @ApiOperation({ summary: '获取队列统计信息（管理员专用）' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    schema: {
      type: 'object',
      properties: {
        waiting: { type: 'number' },
        active: { type: 'number' },
        completed: { type: 'number' },
        failed: { type: 'number' },
        delayed: { type: 'number' },
        paused: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '需要管理员权限' })
  async getQueueStats() {
    this.logger.log('获取队列统计信息');

    // 注意：这里需要访问队列实例来获取统计信息
    // 实际实现可能需要在VideoProcessingService中添加相应方法

    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
      message: '队列统计功能待实现',
    };
  }

  /**
   * 重试失败的任务（管理员专用）
   * @param jobId 任务ID
   * @returns 重试结果
   */
  @Post('jobs/:jobId/retry')
  @UseGuards(AdminRoleGuard)
  @ApiOperation({ summary: '重试失败的任务（管理员专用）' })
  @ApiResponse({
    status: 200,
    description: '重试成功',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '需要管理员权限' })
  @ApiResponse({ status: 404, description: '任务不存在' })
  @HttpCode(HttpStatus.OK)
  async retryJob(@Param('jobId') jobId: string) {
    this.logger.log(`重试任务: ${jobId}`);

    // 实际实现需要从失败任务中获取原始数据并重新提交
    // 这里提供基础响应结构

    return {
      success: true,
      message: '任务重试功能待实现',
    };
  }

  /**
   * 获取任务列表（管理员专用）
   * @param status 状态筛选
   * @param limit 限制数量
   * @param offset 偏移量
   * @returns 任务列表
   */
  @Get('jobs')
  @UseGuards(AdminRoleGuard)
  @ApiOperation({ summary: '获取任务列表（管理员专用）' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    schema: {
      type: 'object',
      properties: {
        jobs: {
          type: 'array',
          items: { $ref: '#/components/schemas/JobStatusResponseDto' },
        },
        total: { type: 'number' },
        limit: { type: 'number' },
        offset: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '需要管理员权限' })
  async getJobs(
    @Query('status') status?: string,
    @Query('limit') limit: number = 20,
    @Query('offset') offset: number = 0,
  ) {
    this.logger.log(
      `获取任务列表: status=${status}, limit=${limit}, offset=${offset}`,
    );

    // 实际实现需要查询队列中的任务
    // 这里提供基础响应结构

    return {
      jobs: [],
      total: 0,
      limit,
      offset,
      message: '任务列表功能待完善',
    };
  }

  /**
   * 暂停队列（管理员专用）
   * @returns 暂停结果
   */
  @Post('queue/pause')
  @UseGuards(AdminRoleGuard)
  @ApiOperation({ summary: '暂停队列（管理员专用）' })
  @ApiResponse({
    status: 200,
    description: '暂停成功',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '需要管理员权限' })
  @HttpCode(HttpStatus.OK)
  async pauseQueue() {
    this.logger.log('暂停队列');

    // 实际实现需要调用队列的暂停方法

    return {
      success: true,
      message: '队列暂停功能待实现',
    };
  }

  /**
   * 恢复队列（管理员专用）
   * @returns 恢复结果
   */
  @Post('queue/resume')
  @UseGuards(AdminRoleGuard)
  @ApiOperation({ summary: '恢复队列（管理员专用）' })
  @ApiResponse({
    status: 200,
    description: '恢复成功',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '需要管理员权限' })
  @HttpCode(HttpStatus.OK)
  async resumeQueue() {
    this.logger.log('恢复队列');

    // 实际实现需要调用队列的恢复方法

    return {
      success: true,
      message: '队列恢复功能待实现',
    };
  }
}
