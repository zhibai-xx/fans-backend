import { Controller, Get, Delete, Patch, Param, Body, Query, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { MediaService } from '../media.service';
import { UserUploadFiltersDto } from '../dto/user-upload-record.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('user-uploads')
@UseGuards(JwtAuthGuard)
export class UserUploadController {
  constructor(private readonly mediaService: MediaService) { }

  /**
   * 获取当前用户的上传记录统计
   */
  @Get('stats')
  async getUploadStats(@Request() req) {
    const userId = req.user.id;
    return this.mediaService.getUserUploadStats(userId);
  }

  /**
   * 获取当前用户的上传记录列表
   */
  @Get()
  async getUploadRecords(@Request() req, @Query() filters: UserUploadFiltersDto) {
    const userId = req.user.id;
    return this.mediaService.getUserUploadRecords(userId, filters);
  }

  /**
   * 删除用户自己的媒体记录
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMedia(@Request() req, @Param('id') mediaId: string) {
    const userId = req.user.id;
    await this.mediaService.deleteUserMedia(userId, mediaId);
  }

  /**
   * 重新提交被拒绝的媒体
   */
  @Patch(':id/resubmit')
  async resubmitMedia(
    @Request() req,
    @Param('id') mediaId: string,
    @Body() updateData: {
      title?: string;
      description?: string;
      category_id?: string;
      tag_ids?: string[];
    }
  ) {
    const userId = req.user.id;
    return this.mediaService.resubmitRejectedMedia(userId, mediaId, updateData);
  }
} 