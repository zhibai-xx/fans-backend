import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { DownloadRecordService } from '../services/download-record.service';

type RequestWithUser = Request & { user: { id: number } };

@ApiTags('用户下载记录')
@Controller('user')
export class UserDownloadController {
  constructor(private readonly downloadRecordService: DownloadRecordService) {}

  @Get('downloads')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户的下载记录' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getUserDownloads(
    @Req() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 20;
    const result = await this.downloadRecordService.getUserDownloads(
      req.user.id,
      pageNumber,
      limitNumber,
    );

    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  }
}
