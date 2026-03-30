import { ApiProperty } from '@nestjs/swagger';
import { MediaType, MediaStatus, Prisma } from '@prisma/client';
import { Transform } from 'class-transformer';
import { convertToAccessibleUrl } from '../utils/media-path.util';

type MediaTagRelation = {
  tag: {
    id: string;
    name: string;
  };
};

type MediaResponseInput = {
  id: string;
  title: string;
  description?: string | null;
  url: string;
  thumbnail_url?: string | null;
  size: number;
  media_type: MediaType;
  duration?: number | null;
  width?: number | null;
  height?: number | null;
  status: MediaStatus;
  views: number;
  likes_count: number;
  favorites_count: number;
  source: string;
  original_created_at?: Date | string | null;
  source_metadata?: Prisma.JsonValue | null;
  created_at: Date | string;
  updated_at: Date | string;
  user?: {
    username?: string | null;
    avatar_url?: string | null;
  } | null;
  category?: {
    id: string;
    name: string;
    description?: string | null;
  } | null;
  media_tags?: MediaTagRelation[];
  video_qualities?: Array<{
    id: string;
    quality: string;
    url: string;
    size: number;
    width: number;
    height: number;
  }>;
};

type MediaListMeta = {
  total: number;
};

const isJsonObject = (
  value: Prisma.JsonValue | null | undefined,
): value is Prisma.JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toIsoStringValue = (value: unknown): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return new Date().toISOString();
};

const toIsoStringOrNull = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return null;
};

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

export class VideoQualityDto {
  @ApiProperty({ description: '视频质量ID' })
  id: string;

  @ApiProperty({ description: '质量标识 (720p, 480p, 360p)' })
  quality: string;

  @ApiProperty({ description: '视频文件URL' })
  url: string;

  @ApiProperty({ description: '文件大小(字节)' })
  size: number;

  @ApiProperty({ description: '视频宽度' })
  width: number;

  @ApiProperty({ description: '视频高度' })
  height: number;
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

  @ApiProperty({ description: '原始素材URL', required: false })
  original_file_url?: string;

  @ApiProperty({
    description: '原始创建时间（来源平台发布时间等）',
    required: false,
  })
  @Transform(({ value }) => toIsoStringOrNull(value))
  original_created_at?: string | null;

  @ApiProperty({ description: '来源相关元数据', required: false })
  source_metadata?: Prisma.JsonValue;

  @ApiProperty({ description: '创建时间' })
  @Transform(({ value }) => toIsoStringValue(value))
  created_at: string;

  @ApiProperty({ description: '更新时间' })
  @Transform(({ value }) => toIsoStringValue(value))
  updated_at: string;

  @ApiProperty({ description: '用户信息', type: MediaUserDto })
  user: MediaUserDto;

  @ApiProperty({
    description: '分类信息',
    type: MediaCategoryDto,
    required: false,
  })
  category?: MediaCategoryDto;

  @ApiProperty({ description: '标签列表', type: [MediaTagDto] })
  tags: MediaTagDto[];

  @ApiProperty({ description: '媒体标签关联列表（用于审核页面兼容）' })
  media_tags: Array<{
    tag: {
      id: string;
      name: string;
    };
  }>;

  @ApiProperty({
    description: '视频质量列表（仅视频类型有效）',
    type: [VideoQualityDto],
    required: false,
  })
  video_qualities?: VideoQualityDto[];

  constructor(media: MediaResponseInput, userUuid: string) {
    this.id = media.id;
    this.title = media.title;
    this.description = media.description ?? undefined;

    // 修复URL路径 - 转换为完整的可访问URL
    this.url = convertToAccessibleUrl(media.url);
    this.thumbnail_url = media.thumbnail_url
      ? convertToAccessibleUrl(media.thumbnail_url)
      : undefined;

    this.size = media.size;
    this.media_type = media.media_type;
    this.duration = media.duration ?? undefined;
    this.width = media.width ?? undefined;
    this.height = media.height ?? undefined;
    this.status = media.status;
    this.views = media.views;
    this.likes_count = media.likes_count;
    this.favorites_count = media.favorites_count;
    this.source = media.source;
    const originalCreatedAt = toIsoStringOrNull(media.original_created_at);
    this.original_created_at = originalCreatedAt ?? undefined;
    this.source_metadata = media.source_metadata;
    const metadata = isJsonObject(media.source_metadata)
      ? media.source_metadata
      : null;
    const originalFileUrl =
      metadata && typeof metadata.original_file_url === 'string'
        ? metadata.original_file_url
        : media.url;
    this.original_file_url = originalFileUrl
      ? convertToAccessibleUrl(originalFileUrl)
      : undefined;

    // 直接赋值，让@Transform装饰器处理序列化
    this.created_at =
      typeof media.created_at === 'string'
        ? media.created_at
        : toIsoStringValue(media.created_at);
    this.updated_at =
      typeof media.updated_at === 'string'
        ? media.updated_at
        : toIsoStringValue(media.updated_at);

    // 用户信息（使用UUID）
    this.user = {
      uuid: userUuid,
      username: media.user?.username ?? '',
      avatar_url: media.user?.avatar_url ?? undefined,
    };

    // 分类信息
    this.category = media.category
      ? {
          id: media.category.id,
          name: media.category.name,
          description: media.category.description ?? undefined,
        }
      : undefined;

    // 标签信息 - 修复：使用media_tags而不是tags
    this.tags =
      media.media_tags?.map((mediaTag) => ({
        id: mediaTag.tag.id,
        name: mediaTag.tag.name,
      })) || [];

    // 兼容审核页面的标签格式
    this.media_tags =
      media.media_tags?.map((mediaTag) => ({
        tag: {
          id: mediaTag.tag.id,
          name: mediaTag.tag.name,
        },
      })) || [];

    // 处理视频质量数据（仅对视频类型有效）
    this.video_qualities =
      media.video_qualities?.map((quality) => ({
        id: quality.id,
        quality: quality.quality,
        url: convertToAccessibleUrl(quality.url), // 🔑 关键：也要转换video_qualities的URL
        size: quality.size,
        width: quality.width,
        height: quality.height,
      })) || [];
  }
}

export class MediaListResponseDto {
  @ApiProperty({ description: '请求是否成功' })
  success: boolean;

  @ApiProperty({ description: '媒体列表', type: [MediaResponseDto] })
  data: MediaResponseDto[];

  @ApiProperty({ description: '分页信息' })
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };

  constructor(
    data: MediaResponseDto[],
    meta: MediaListMeta,
    skip: number = 0,
    take: number = 20,
  ) {
    this.success = true;
    this.data = data;

    // 将后端的meta格式转换为规范的pagination格式
    const page = Math.floor(skip / take) + 1;
    const totalPages = Math.ceil(meta.total / take);

    this.pagination = {
      page,
      limit: take,
      total: meta.total,
      totalPages,
    };
  }
}
