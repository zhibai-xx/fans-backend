import {
  Controller,
  Get,
  Delete,
  Patch,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { MediaService } from '../media.service';
import { UserUploadFiltersDto } from '../dto/user-upload-record.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

type RequestWithUser = ExpressRequest & { user: { id: number } };

type UserMediaUpdatePayload = {
  title?: string;
  description?: string;
  category_id?: string;
  tag_ids?: string[];
};

@Controller('user-uploads')
@UseGuards(JwtAuthGuard)
export class UserUploadController {
  constructor(private readonly mediaService: MediaService) {}

  /**
   * 获取当前用户的上传记录统计
   */
  @Get('stats')
  async getUploadStats(@Req() req: RequestWithUser) {
    const userId = req.user.id;
    return this.mediaService.getUserUploadStats(userId);
  }

  /**
   * 获取当前用户的上传记录列表
   */
  @Get()
  async getUploadRecords(
    @Req() req: RequestWithUser,
    @Query() filters: UserUploadFiltersDto,
  ) {
    const userId = req.user.id;
    return this.mediaService.getUserUploadRecords(userId, filters);
  }

  /**
   * 删除用户自己的媒体记录
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMedia(@Req() req: RequestWithUser, @Param('id') mediaId: string) {
    const userId = req.user.id;
    await this.mediaService.deleteUserMedia(userId, mediaId);
  }

  /**
   * 编辑待审核媒体
   */
  @Patch(':id')
  async updateDraft(
    @Req() req: RequestWithUser,
    @Param('id') mediaId: string,
    @Body() updateData: UserMediaUpdatePayload,
  ) {
    const userId = req.user.id;
    return this.mediaService.updateUserMediaDraft(userId, mediaId, updateData);
  }

  /**
   * 重新提交被拒绝的媒体
   */
  @Patch(':id/resubmit')
  async resubmitMedia(
    @Req() req: RequestWithUser,
    @Param('id') mediaId: string,
    @Body() updateData: UserMediaUpdatePayload,
  ) {
    const userId = req.user.id;
    return this.mediaService.resubmitRejectedMedia(userId, mediaId, updateData);
  }

  /**
   * 撤回待审核投稿
   */
  @Post(':id/withdraw')
  async withdrawMedia(
    @Req() req: RequestWithUser,
    @Param('id') mediaId: string,
  ) {
    const userId = req.user.id;
    return this.mediaService.withdrawUserMedia(userId, mediaId);
  }
}
