import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../auth/guards/admin-role.guard';
import { MediaService } from '../media.service';
import { MediaType, MediaStatus } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

interface MediaFilters {
  visibility?: 'VISIBLE' | 'HIDDEN';
  status?: MediaStatus;
  media_type?: MediaType;
  category_id?: string;
  date_range?: string;
  search?: string;
  user_id?: number;
}

interface BatchVisibilityUpdateDto {
  mediaIds: string[];
  visibility: 'VISIBLE' | 'HIDDEN';
}

interface BatchDeleteDto {
  mediaIds: string[];
}

@ApiTags('管理员-媒体管理')
@Controller('admin/media')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
@ApiBearerAuth()
export class AdminMediaController {
  constructor(private readonly mediaService: MediaService) { }

  /**
   * 获取所有媒体内容（管理员专用）
   */
  @Get()
  @ApiOperation({ summary: '获取所有媒体内容（管理员专用）' })
  async getAllMedia(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
    @Query('visibility') visibility?: 'VISIBLE' | 'HIDDEN',
    @Query('status') status?: MediaStatus,
    @Query('media_type') media_type?: MediaType,
    @Query('category_id') category_id?: string,
    @Query('date_range') date_range?: string,
    @Query('search') search?: string,
    @Query('user_id', new ParseIntPipe({ optional: true })) user_id?: number,
  ) {
    try {
      const filters: MediaFilters = {
        visibility,
        status,
        media_type,
        category_id,
        date_range,
        search,
        user_id,
      };

      const result = await this.mediaService.getAllMediaForAdmin(filters, page, limit);

      return {
        success: true,
        data: result.data,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * 获取媒体统计信息
   */
  @Get('stats')
  @ApiOperation({ summary: '获取媒体统计信息（管理员专用）' })
  async getMediaStats() {
    try {
      const stats = await this.mediaService.getMediaStatsForAdmin();
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * 获取单个媒体详情
   */
  @Get(':id')
  @ApiOperation({ summary: '获取单个媒体详情（管理员专用）' })
  async getMediaDetail(@Param('id') id: string) {
    try {
      const media = await this.mediaService.getMediaDetailForAdmin(id);
      return {
        success: true,
        data: media,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * 更新媒体显示状态（单个）
   */
  @Put(':id/visibility')
  @ApiOperation({ summary: '更新媒体显示状态（单个）' })
  async updateMediaVisibility(
    @Param('id') id: string,
    @Body() body: { visibility: 'VISIBLE' | 'HIDDEN' }
  ) {
    try {
      const media = await this.mediaService.updateMediaVisibilityForAdmin(
        id,
        body.visibility
      );
      return {
        success: true,
        data: media,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * 批量更新媒体显示状态
   */
  @Post('batch/visibility')
  @ApiOperation({ summary: '批量更新媒体显示状态' })
  async batchUpdateVisibility(@Body() body: BatchVisibilityUpdateDto) {
    try {
      const result = await this.mediaService.batchUpdateMediaVisibility(
        body.mediaIds,
        body.visibility
      );
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * 更新媒体信息
   */
  @Put(':id')
  @ApiOperation({ summary: '更新媒体信息' })
  async updateMediaInfo(
    @Param('id') id: string,
    @Body() updateData: {
      title?: string;
      description?: string;
      category_id?: string;
      tag_ids?: string[];
    }
  ) {
    try {
      const result = await this.mediaService.updateMediaInfoForAdmin(id, updateData);
      return {
        success: true,
        data: result,
        message: '媒体信息更新成功',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * 删除单个媒体
   */
  @Delete(':id')
  @ApiOperation({ summary: '删除单个媒体' })
  async deleteMedia(@Param('id') id: string) {
    try {
      await this.mediaService.batchDeleteMedia([id]);
      return {
        success: true,
        message: '删除成功',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * 批量删除媒体
   */
  @Delete('batch')
  @ApiOperation({ summary: '批量删除媒体' })
  async batchDeleteMedia(@Body() body: BatchDeleteDto) {
    try {
      const result = await this.mediaService.batchDeleteMedia(body.mediaIds);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * 批量删除媒体 (POST方式，避免DELETE请求体问题)
   */
  @Post('batch/delete')
  @ApiOperation({ summary: '批量删除媒体 (POST方式)' })
  async batchDeleteMediaPost(@Body() body: BatchDeleteDto) {
    try {
      const result = await this.mediaService.batchDeleteMedia(body.mediaIds);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * 获取用户上传统计
   */
  @Get('users/stats')
  @ApiOperation({ summary: '获取用户上传统计' })
  async getUserUploadStats(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20
  ) {
    try {
      const result = await this.mediaService.getAllUserUploadStats();
      return {
        success: true,
        data: result.topUsers, // 修正返回数据字段
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * 获取分类使用统计
   */
  @Get('categories/usage')
  @ApiOperation({ summary: '获取分类使用统计' })
  async getCategoryUsageStats() {
    try {
      const result = await this.mediaService.getAllCategoriesWithStats();
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * 获取标签使用统计
   */
  @Get('tags/usage')
  @ApiOperation({ summary: '获取标签使用统计' })
  async getTagUsageStats() {
    try {
      const result = await this.mediaService.getAllTagsWithStats();
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}