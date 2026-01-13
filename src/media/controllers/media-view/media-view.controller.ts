import {
  Body,
  Controller,
  Post,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { OptionalJwtAuthGuard } from 'src/auth/guards/optional-jwt-auth.guard';
import { MediaService } from '../../media.service';
import { IncrementViewDto } from '../../dto/increment-view.dto';
import { MediaViewTrackerService } from '../../services/media-view-tracker.service';

type RequestWithUser = ExpressRequest & {
  user?: { id: number };
};

@ApiTags('媒体浏览')
@Controller('media')
export class MediaViewController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly mediaViewTracker: MediaViewTrackerService,
  ) {}

  /**
   * 增加媒体观看次数
   */
  @Post(':mediaId/view')
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '增加媒体观看次数' })
  @ApiParam({ name: 'mediaId', description: '媒体ID' })
  @ApiBody({ type: IncrementViewDto, required: false })
  @ApiResponse({ status: 200, description: '观看次数已增加' })
  async incrementView(
    @Param('mediaId') mediaId: string,
    @Body() body: IncrementViewDto,
    @Req() req: RequestWithUser,
  ) {
    const sessionId =
      body.sessionId ||
      (typeof req.headers['x-session-id'] === 'string'
        ? req.headers['x-session-id']
        : undefined);

    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      undefined;

    const shouldCount = this.mediaViewTracker.shouldCount(mediaId, {
      userId: req.user?.id,
      sessionId,
      ip: clientIp,
    });

    if (!shouldCount) {
      return {
        success: true,
        data: {
          media_id: mediaId,
          dedupe: true,
        },
      };
    }

    const result = await this.mediaService.incrementViewCount(mediaId);
    return {
      success: true,
      data: {
        ...result,
        media_type: body.mediaType ?? null,
        event: body.event ?? null,
        dedupe: false,
      },
    };
  }
}
