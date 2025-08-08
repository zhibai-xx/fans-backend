import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { UserUuidService } from 'src/auth/services/user-uuid.service';
import { MyLoggerService } from 'src/my-logger/my-logger.service';
import { MediaInteractionService } from '../media-interaction.service';
import {
  CreateFavoriteDto,
  FavoriteResponseDto,
  FavoriteStatusDto,
  FavoriteListQueryDto,
  FavoriteListResponseDto,
} from '../dto/favorite.dto';
import {
  CreateLikeDto,
  LikeResponseDto,
  LikeStatusDto,
  MediaInteractionStatusDto,
  BatchLikeStatusDto,
  BatchFavoriteStatusDto,
} from '../dto/like.dto';

// 扩展 Request 类型
type RequestWithUser = ExpressRequest & { user: { id: number, [key: string]: any } };

@ApiTags('媒体互动')
@Controller('media/interaction')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@UseInterceptors(ClassSerializerInterceptor)
export class MediaInteractionController {
  private readonly logger = new MyLoggerService(MediaInteractionController.name);

  constructor(
    private readonly mediaInteractionService: MediaInteractionService,
    private readonly userUuidService: UserUuidService,
  ) { }

  // ===========================================
  // 点赞相关接口
  // ===========================================

  /**
   * 点赞媒体
   */
  @Post('like')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '点赞媒体' })
  @ApiResponse({
    status: 201,
    description: '点赞成功',
    type: LikeResponseDto,
  })
  @ApiResponse({ status: 400, description: '已经点赞过该媒体' })
  @ApiResponse({ status: 404, description: '媒体不存在' })
  async likeMedia(
    @Body() createLikeDto: CreateLikeDto,
    @Req() req: RequestWithUser,
  ): Promise<{ success: boolean; data: LikeResponseDto }> {
    const userUuid = await this.userUuidService.getUuidByInternalId(req.user.id);
    const like = await this.mediaInteractionService.likeMedia(
      req.user.id,
      createLikeDto.media_id,
    );

    return {
      success: true,
      data: new LikeResponseDto(like, userUuid),
    };
  }

  /**
   * 取消点赞
   */
  @Delete('like/:mediaId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取消点赞' })
  @ApiParam({ name: 'mediaId', description: '媒体ID' })
  @ApiResponse({ status: 200, description: '取消点赞成功' })
  @ApiResponse({ status: 404, description: '未找到点赞记录' })
  async unlikeMedia(
    @Param('mediaId') mediaId: string,
    @Req() req: RequestWithUser,
  ): Promise<{ success: boolean; message: string }> {
    await this.mediaInteractionService.unlikeMedia(req.user.id, mediaId);
    return {
      success: true,
      message: '取消点赞成功',
    };
  }

  /**
   * 获取点赞状态
   */
  @Get('like/status/:mediaId')
  @ApiOperation({ summary: '获取媒体点赞状态' })
  @ApiParam({ name: 'mediaId', description: '媒体ID' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: LikeStatusDto,
  })
  async getLikeStatus(
    @Param('mediaId') mediaId: string,
    @Req() req: RequestWithUser,
  ): Promise<{ success: boolean; data: LikeStatusDto }> {
    const status = await this.mediaInteractionService.getLikeStatus(
      req.user.id,
      mediaId,
    );
    return {
      success: true,
      data: status,
    };
  }

  // ===========================================
  // 收藏相关接口
  // ===========================================

  /**
   * 收藏媒体
   */
  @Post('favorite')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '收藏媒体' })
  @ApiResponse({
    status: 201,
    description: '收藏成功',
    type: FavoriteResponseDto,
  })
  @ApiResponse({ status: 400, description: '已经收藏过该媒体' })
  @ApiResponse({ status: 404, description: '媒体不存在' })
  async favoriteMedia(
    @Body() createFavoriteDto: CreateFavoriteDto,
    @Req() req: RequestWithUser,
  ): Promise<{ success: boolean; data: FavoriteResponseDto }> {
    const userUuid = await this.userUuidService.getUuidByInternalId(req.user.id);
    const favorite = await this.mediaInteractionService.favoriteMedia(
      req.user.id,
      createFavoriteDto.media_id,
    );

    return {
      success: true,
      data: new FavoriteResponseDto(favorite, userUuid),
    };
  }

  /**
   * 取消收藏
   */
  @Delete('favorite/:mediaId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取消收藏' })
  @ApiParam({ name: 'mediaId', description: '媒体ID' })
  @ApiResponse({ status: 200, description: '取消收藏成功' })
  @ApiResponse({ status: 404, description: '未找到收藏记录' })
  async unfavoriteMedia(
    @Param('mediaId') mediaId: string,
    @Req() req: RequestWithUser,
  ): Promise<{ success: boolean; message: string }> {
    await this.mediaInteractionService.unfavoriteMedia(req.user.id, mediaId);
    return {
      success: true,
      message: '取消收藏成功',
    };
  }

  /**
   * 获取收藏状态
   */
  @Get('favorite/status/:mediaId')
  @ApiOperation({ summary: '获取媒体收藏状态' })
  @ApiParam({ name: 'mediaId', description: '媒体ID' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: FavoriteStatusDto,
  })
  async getFavoriteStatus(
    @Param('mediaId') mediaId: string,
    @Req() req: RequestWithUser,
  ): Promise<{ success: boolean; data: FavoriteStatusDto }> {
    const status = await this.mediaInteractionService.getFavoriteStatus(
      req.user.id,
      mediaId,
    );
    return {
      success: true,
      data: status,
    };
  }

  /**
   * 获取用户收藏列表
   */
  @Get('favorites/my')
  @ApiOperation({ summary: '获取我的收藏列表' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: FavoriteListResponseDto,
  })
  async getMyFavorites(
    @Query() query: FavoriteListQueryDto,
    @Req() req: RequestWithUser,
  ): Promise<{ success: boolean; data: any[]; pagination: any }> {
    const userUuid = await this.userUuidService.getUuidByInternalId(req.user.id);
    const result = await this.mediaInteractionService.getUserFavorites(
      req.user.id,
      query.page || 1,
      query.limit || 20,
    );

    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  }

  // ===========================================
  // 综合状态接口
  // ===========================================

  /**
   * 获取媒体互动状态（点赞+收藏）
   */
  @Get('status/:mediaId')
  @ApiOperation({ summary: '获取媒体互动状态（点赞+收藏）' })
  @ApiParam({ name: 'mediaId', description: '媒体ID' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: MediaInteractionStatusDto,
  })
  async getMediaInteractionStatus(
    @Param('mediaId') mediaId: string,
    @Req() req: RequestWithUser,
  ): Promise<{ success: boolean; data: MediaInteractionStatusDto }> {
    const status = await this.mediaInteractionService.getMediaInteractionStatus(
      req.user.id,
      mediaId,
    );
    return {
      success: true,
      data: status,
    };
  }

  /**
   * 批量获取点赞状态
   */
  @Post('batch/like-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '批量获取点赞状态' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: BatchLikeStatusDto,
  })
  async getBatchLikeStatus(
    @Body() body: { media_ids: string[] },
    @Req() req: RequestWithUser,
  ): Promise<{ success: boolean; data: BatchLikeStatusDto }> {
    const status = await this.mediaInteractionService.getBatchLikeStatus(
      req.user.id,
      body.media_ids,
    );
    return {
      success: true,
      data: status,
    };
  }

  /**
   * 批量获取收藏状态
   */
  @Post('batch/favorite-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '批量获取收藏状态' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: BatchFavoriteStatusDto,
  })
  async getBatchFavoriteStatus(
    @Body() body: { media_ids: string[] },
    @Req() req: RequestWithUser,
  ): Promise<{ success: boolean; data: BatchFavoriteStatusDto }> {
    const status = await this.mediaInteractionService.getBatchFavoriteStatus(
      req.user.id,
      body.media_ids,
    );
    return {
      success: true,
      data: status,
    };
  }
}
