import { Injectable } from '@nestjs/common';
import { Media, MediaType } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import {
  DownloadRecordDto,
  DownloadRecordWithMedia,
} from '../dto/download-record.dto';

@Injectable()
export class DownloadRecordService {
  constructor(private readonly databaseService: DatabaseService) {}

  async logDownload(
    userId: number,
    media: Media,
    options?: { fileType?: string | null },
  ) {
    const fileType = options?.fileType ?? this.extractFileType(media.url);
    const fileName = this.buildFileName(media.title, fileType);

    await this.databaseService.downloadRecord.create({
      data: {
        user_id: userId,
        media_id: media.id,
        media_type: media.media_type as MediaType,
        file_name: fileName,
        file_type: fileType,
        file_size: media.size ?? null,
      },
    });
  }

  async getUserDownloads(userId: number, page: number = 1, limit: number = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const skip = (safePage - 1) * safeLimit;

    const [records, total] = await Promise.all([
      this.databaseService.downloadRecord.findMany({
        where: { user_id: userId },
        include: {
          media: {
            select: {
              id: true,
              title: true,
              thumbnail_url: true,
              url: true,
              media_type: true,
              size: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.databaseService.downloadRecord.count({
        where: { user_id: userId },
      }),
    ]);

    return {
      data: records.map(
        (record) => new DownloadRecordDto(record as DownloadRecordWithMedia),
      ),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
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
