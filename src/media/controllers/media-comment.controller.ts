import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { MediaCommentService } from '../services/media-comment.service';
import {
  CommentListQueryDto,
  CommentListResponseDto,
  CommentResponseDto,
  CreateCommentDto,
} from '../dto/comment.dto';

type RequestWithUser = ExpressRequest & {
  user: { id: number; [key: string]: unknown };
};

@ApiTags('媒体留言')
@Controller('media/:mediaId/comments')
@UseInterceptors(ClassSerializerInterceptor)
export class MediaCommentController {
  constructor(private readonly mediaCommentService: MediaCommentService) {}

  @Get()
  @ApiOperation({ summary: '获取媒体留言列表' })
  @ApiParam({ name: 'mediaId', description: '媒体ID' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: CommentListResponseDto,
  })
  async listComments(
    @Param('mediaId') mediaId: string,
    @Query() query: CommentListQueryDto,
  ): Promise<CommentListResponseDto> {
    return this.mediaCommentService.listComments(mediaId, query);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '发布媒体留言' })
  @ApiParam({ name: 'mediaId', description: '媒体ID' })
  @ApiResponse({
    status: 201,
    description: '发布成功',
    type: CommentResponseDto,
  })
  async createComment(
    @Param('mediaId') mediaId: string,
    @Body() dto: CreateCommentDto,
    @Req() req: RequestWithUser,
  ): Promise<{ success: boolean; data: CommentResponseDto }> {
    const comment = await this.mediaCommentService.createComment(
      mediaId,
      req.user.id,
      dto,
    );
    return { success: true, data: comment };
  }
}
