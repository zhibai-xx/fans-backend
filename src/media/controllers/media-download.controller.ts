import {
  Controller,
  Post,
  Param,
  UseGuards,
  Req,
  UnauthorizedException,
  Get,
  Query,
  Res,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { OptionalJwtAuthGuard } from 'src/auth/guards/optional-jwt-auth.guard';
import { MediaService } from '../media.service';
import { DownloadRecordService } from '../services/download-record.service';
import { convertToAccessibleUrl } from '../utils/media-path.util';
import { createHmac, timingSafeEqual } from 'crypto';
import { GuestDownloadRateLimitService } from '../services/guest-download-rate-limit.service';

type RequestWithUser = Request & {
  user?: { id: number };
};

@ApiTags('媒体下载')
@Controller('media')
export class MediaDownloadController {
  private readonly guestLimitWindowMs = 60 * 60 * 1000;
  private readonly guestHourlyLimit = 20;
  private readonly guestMinIntervalMs = 10 * 1000;
  private readonly signedUrlTtlMs = 60 * 1000;

  constructor(
    private readonly mediaService: MediaService,
    private readonly downloadRecordService: DownloadRecordService,
    private readonly guestDownloadRateLimitService: GuestDownloadRateLimitService,
  ) {}

  @Post(':mediaId/download')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: '请求下载媒体文件并记录下载' })
  @ApiParam({ name: 'mediaId', description: '媒体ID' })
  @ApiResponse({ status: 200, description: '返回可下载地址' })
  async downloadMedia(
    @Param('mediaId') mediaId: string,
    @Req() req: RequestWithUser,
  ) {
    const media = await this.mediaService.findOne(mediaId);
    const fileType = this.extractFileType(media.url);
    const userId = req.user?.id;
    if (typeof userId === 'number') {
      await this.downloadRecordService.logDownload(userId, media, {
        fileType,
      });
    } else {
      const guestKey = this.resolveGuestKey(req);
      const limitResult = await this.guestDownloadRateLimitService.checkLimit(
        guestKey,
        {
          windowMs: this.guestLimitWindowMs,
          maxRequests: this.guestHourlyLimit,
          minIntervalMs: this.guestMinIntervalMs,
        },
      );
      if (!limitResult.allowed) {
        throw new HttpException(
          limitResult.reason || '下载请求过于频繁，请稍后再试',
          limitResult.statusCode ?? HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const expiresAt = Date.now() + this.signedUrlTtlMs;
    const signature = this.signDownload(media.id, expiresAt);
    const signedPath = `/api/media/${media.id}/download/signed?expires=${expiresAt}&signature=${signature}`;

    return {
      success: true,
      data: {
        media_id: media.id,
        media_type: media.media_type,
        download_url: signedPath,
        filename: this.buildFileName(media.title, fileType),
      },
    };
  }

  @Get(':mediaId/download/signed')
  @ApiOperation({ summary: '下载签名链接校验并跳转到文件地址' })
  @ApiParam({ name: 'mediaId', description: '媒体ID' })
  @ApiResponse({ status: 302, description: '校验成功，跳转到文件地址' })
  async redirectSignedDownload(
    @Param('mediaId') mediaId: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Res() res: Response,
  ) {
    const expiresAt = Number.parseInt(expires, 10);
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
      throw new UnauthorizedException('下载链接已过期，请重新请求');
    }

    if (!this.verifyDownloadSignature(mediaId, expiresAt, signature)) {
      throw new UnauthorizedException('下载签名无效');
    }

    const media = await this.mediaService.findOne(mediaId);
    const downloadPath = convertToAccessibleUrl(media.url);
    res.redirect(downloadPath);
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

  private resolveGuestKey(req: Request): string {
    const xForwardedFor = req.headers['x-forwarded-for'];
    const forwardedIp =
      typeof xForwardedFor === 'string'
        ? xForwardedFor.split(',')[0]?.trim()
        : Array.isArray(xForwardedFor)
          ? xForwardedFor[0]
          : '';
    const ip = forwardedIp || req.ip || 'unknown';
    return `guest:${ip}`;
  }

  private signDownload(mediaId: string, expiresAt: number): string {
    const payload = `${mediaId}:${expiresAt}`;
    return createHmac('sha256', this.getDownloadSignSecret())
      .update(payload)
      .digest('hex');
  }

  private verifyDownloadSignature(
    mediaId: string,
    expiresAt: number,
    signature: string,
  ): boolean {
    const expected = this.signDownload(mediaId, expiresAt);
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const signatureBuffer = Buffer.from(signature, 'utf8');
    if (expectedBuffer.length !== signatureBuffer.length) {
      return false;
    }
    return timingSafeEqual(expectedBuffer, signatureBuffer);
  }

  private getDownloadSignSecret(): string {
    const secret =
      process.env.DOWNLOAD_SIGN_SECRET?.trim() ||
      process.env.JWT_SECRET?.trim();
    if (!secret) {
      throw new UnauthorizedException('下载签名密钥未配置');
    }
    return secret;
  }
}
