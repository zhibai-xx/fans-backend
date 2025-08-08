import { ApiProperty } from '@nestjs/swagger';
import { MediaType, MediaStatus } from '@prisma/client';
import { Transform } from 'class-transformer';

export class MediaUserDto {
  @ApiProperty({ description: '用户UUID' })
  uuid: string;

  @ApiProperty({ description: '用户名' })
  username: string;

  @ApiProperty({ description: '头像URL', required: false })
  avatar_url?: string;
}

export class MediaCategoryDto {
  @ApiProperty({ description: '分类ID' })
  id: string;

  @ApiProperty({ description: '分类名称' })
  name: string;

  @ApiProperty({ description: '分类描述', required: false })
  description?: string;
}

export class MediaTagDto {
  @ApiProperty({ description: '标签ID' })
  id: string;

  @ApiProperty({ description: '标签名称' })
  name: string;
}

export class MediaResponseDto {
  @ApiProperty({ description: '媒体ID' })
  id: string;

  @ApiProperty({ description: '标题' })
  title: string;

  @ApiProperty({ description: '描述', required: false })
  description?: string;

  @ApiProperty({ description: '资源URL' })
  url: string;

  @ApiProperty({ description: '缩略图URL', required: false })
  thumbnail_url?: string;

  @ApiProperty({ description: '文件大小（字节）' })
  size: number;

  @ApiProperty({ description: '媒体类型', enum: MediaType })
  media_type: MediaType;

  @ApiProperty({ description: '视频时长（秒）', required: false })
  duration?: number;

  @ApiProperty({ description: '宽度（像素）', required: false })
  width?: number;

  @ApiProperty({ description: '高度（像素）', required: false })
  height?: number;

  @ApiProperty({ description: '状态', enum: MediaStatus })
  status: MediaStatus;

  @ApiProperty({ description: '观看次数' })
  views: number;

  @ApiProperty({ description: '点赞数' })
  likes_count: number;

  @ApiProperty({ description: '收藏数' })
  favorites_count: number;

  @ApiProperty({ description: '媒体来源' })
  source: string;

  @ApiProperty({ description: '原始创建时间（微博发布时间等）', required: false })
  @Transform(({ value }) => value ? new Date(value).toISOString() : null)
  original_created_at?: Date;

  @ApiProperty({ description: '来源相关元数据', required: false })
  source_metadata?: any;

  @ApiProperty({ description: '创建时间' })
  @Transform(({ value }) => value ? new Date(value).toISOString() : new Date().toISOString())
  created_at: string;

  @ApiProperty({ description: '更新时间' })
  @Transform(({ value }) => value ? new Date(value).toISOString() : new Date().toISOString())
  updated_at: string;

  @ApiProperty({ description: '用户信息', type: MediaUserDto })
  user: MediaUserDto;

  @ApiProperty({ description: '分类信息', type: MediaCategoryDto, required: false })
  category?: MediaCategoryDto;

  @ApiProperty({ description: '标签列表', type: [MediaTagDto] })
  tags: MediaTagDto[];

  constructor(media: any, userUuid: string) {
    this.id = media.id;
    this.title = media.title;
    this.description = media.description;

    // 修复URL路径 - 转换为完整的可访问URL
    this.url = this.convertToAccessibleUrl(media.url);
    this.thumbnail_url = media.thumbnail_url ? this.convertToAccessibleUrl(media.thumbnail_url) : undefined;

    this.size = media.size;
    this.media_type = media.media_type;
    this.duration = media.duration;
    this.width = media.width;
    this.height = media.height;
    this.status = media.status;
    this.views = media.views;
    this.likes_count = media.likes_count;
    this.favorites_count = media.favorites_count;
    this.source = media.source;
    this.original_created_at = media.original_created_at;
    this.source_metadata = media.source_metadata;

    // 直接赋值，让@Transform装饰器处理序列化
    this.created_at = media.created_at;
    this.updated_at = media.updated_at;

    // 用户信息（使用UUID）
    this.user = {
      uuid: userUuid,
      username: media.user?.username || '',
      avatar_url: media.user?.avatar_url,
    };

    // 分类信息
    this.category = media.category ? {
      id: media.category.id,
      name: media.category.name,
      description: media.category.description,
    } : undefined;

    // 标签信息 - 修复：使用media_tags而不是tags
    this.tags = media.media_tags?.map((mediaTag: any) => ({
      id: mediaTag.tag.id,
      name: mediaTag.tag.name,
    })) || [];
  }

  /**
   * 将相对路径转换为完整的可访问URL
   * 从 "uploads/image/xxx.jpg" 转换为 "http://localhost:3000/api/upload/file/image/xxx.jpg"
   */
  private convertToAccessibleUrl(relativePath: string): string {
    if (!relativePath) return '';

    // 如果已经是完整URL，直接返回
    if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
      return relativePath;
    }

    // 如果已经是API路径，直接返回
    if (relativePath.startsWith('/api/upload/file/')) {
      return `http://localhost:3000${relativePath}`;
    }

    // 处理相对路径：移除uploads/前缀，保留子目录
    // "uploads/image/xxx.jpg" -> "image/xxx.jpg"
    let cleanPath = relativePath;
    if (cleanPath.startsWith('uploads/')) {
      cleanPath = cleanPath.substring('uploads/'.length);
    }

    return `http://localhost:3000/api/upload/file/${cleanPath}`;
  }
}

export class MediaListResponseDto {
  @ApiProperty({ description: '媒体列表', type: [MediaResponseDto] })
  data: MediaResponseDto[];

  @ApiProperty({ description: '分页信息' })
  meta: {
    total: number;
    skip: number;
    take: number;
    hasMore: boolean;
  };

  constructor(data: MediaResponseDto[], meta: any) {
    this.data = data;
    this.meta = meta;
  }
} 