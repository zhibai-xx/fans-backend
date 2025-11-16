import { Controller, Post, Param, UseGuards, Req } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { MediaService } from '../media.service';
import { DownloadRecordService } from '../services/download-record.service';
import { convertToAccessibleUrl } from '../utils/media-path.util';

type RequestWithUser = Request & {
  user: { id: number };
};

@ApiTags('媒体下载')
@Controller('media')
export class MediaDownloadController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly downloadRecordService: DownloadRecordService,
  ) {}

  @Post(':mediaId/download')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '请求下载媒体文件并记录下载' })
  @ApiParam({ name: 'mediaId', description: '媒体ID' })
  @ApiResponse({ status: 200, description: '返回可下载地址' })
  async downloadMedia(
    @Param('mediaId') mediaId: string,
    @Req() req: RequestWithUser,
  ) {
    const media = await this.mediaService.findOne(mediaId);
    const fileType = this.extractFileType(media.url);
    await this.downloadRecordService.logDownload(req.user.id, media, {
      fileType,
    });

    const downloadPath = convertToAccessibleUrl(media.url);

    return {
      success: true,
      data: {
        media_id: media.id,
        media_type: media.media_type,
        download_url: downloadPath,
        filename: this.buildFileName(media.title, fileType),
      },
    };
  }

  private extractFileType(url: string | null): string | null {
    if (!url) return null;
    const clean = url.split('?')[0];
    const match = clean.match(/\.([0-9a-zA-Z]+)$/);
    if (match && match[1]) {
      return match[1].toLowerCase();
    }
    return null;
  }

  private buildFileName(title: string, fileType: string | null): string {
    const safeTitle = title?.trim() ? title.trim() : 'media';
    if (fileType) {
      return `${safeTitle}.${fileType}`;
    }
    return safeTitle;
  }
}
