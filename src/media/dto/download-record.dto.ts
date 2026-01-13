import { ApiProperty } from '@nestjs/swagger';
import { MediaType, DownloadRecord } from '@prisma/client';
import { convertToAccessibleUrl } from '../utils/media-path.util';

export type DownloadRecordWithMedia = DownloadRecord & {
  media: {
    id: string;
    title: string;
    thumbnail_url?: string | null;
    url: string;
    media_type: MediaType;
    size: number | null;
  };
};

export class DownloadRecordDto {
  @ApiProperty({ description: '下载记录ID' })
  id: string;

  @ApiProperty({ description: '媒体ID' })
  media_id: string;

  @ApiProperty({ description: '媒体类型', enum: MediaType })
  media_type: MediaType;

  @ApiProperty({ description: '媒体标题' })
  title: string;

  @ApiProperty({ description: '缩略图地址', required: false })
  thumbnail_url?: string;

  @ApiProperty({ description: '可访问的下载路径' })
  download_path: string;

  @ApiProperty({ description: '文件大小（字节）', required: false })
  file_size?: number;

  @ApiProperty({ description: '文件类型', required: false })
  file_type?: string;

  @ApiProperty({ description: '下载时间 (ISO)' })
  downloaded_at: string;

  constructor(record: DownloadRecordWithMedia) {
    this.id = record.id;
    this.media_id = record.media_id;
    this.media_type = record.media_type;
    this.title = record.media.title;
    this.thumbnail_url = convertToAccessibleUrl(
      record.media.thumbnail_url || '',
    );
    this.download_path = convertToAccessibleUrl(record.media.url);
    this.file_size = record.file_size ?? record.media.size ?? undefined;
    this.file_type = record.file_type ?? undefined;
    this.downloaded_at = record.created_at.toISOString();
  }
}
