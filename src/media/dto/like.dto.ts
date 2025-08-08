import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * 点赞媒体DTO
 */
export class CreateLikeDto {
  /**
   * 媒体ID
   * @example "123e4567-e89b-12d3-a456-426614174000"
   */
  @ApiProperty({ description: '媒体ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsNotEmpty()
  media_id: string;
}

/**
 * 点赞记录响应DTO
 */
export class LikeResponseDto {
  @ApiProperty({ description: '点赞记录ID' })
  id: string;

  @ApiProperty({ description: '媒体ID' })
  media_id: string;

  @ApiProperty({ description: '用户UUID' })
  user_uuid: string;

  @ApiProperty({ description: '点赞时间' })
  @Transform(({ value }) => value ? new Date(value).toISOString() : new Date().toISOString())
  created_at: string;

  constructor(like: any, userUuid: string) {
    this.id = like.id;
    this.media_id = like.media_id;
    this.user_uuid = userUuid;
    this.created_at = like.created_at;
  }
}

/**
 * 点赞状态DTO
 */
export class LikeStatusDto {
  @ApiProperty({ description: '是否已点赞' })
  is_liked: boolean;

  @ApiProperty({ description: '点赞总数' })
  likes_count: number;

  constructor(is_liked: boolean, likes_count: number) {
    this.is_liked = is_liked;
    this.likes_count = likes_count;
  }
}

/**
 * 媒体互动状态DTO（点赞+收藏）
 */
export class MediaInteractionStatusDto {
  @ApiProperty({ description: '是否已点赞' })
  is_liked: boolean;

  @ApiProperty({ description: '是否已收藏' })
  is_favorited: boolean;

  @ApiProperty({ description: '点赞总数' })
  likes_count: number;

  @ApiProperty({ description: '收藏总数' })
  favorites_count: number;

  constructor(is_liked: boolean, is_favorited: boolean, likes_count: number, favorites_count: number) {
    this.is_liked = is_liked;
    this.is_favorited = is_favorited;
    this.likes_count = likes_count;
    this.favorites_count = favorites_count;
  }
}

/**
 * 批量点赞状态DTO
 */
export class BatchLikeStatusDto {
  @ApiProperty({
    description: '媒体ID与点赞状态的映射',
    type: 'object',
    additionalProperties: { type: 'boolean' },
    example: { 'media-id-1': true, 'media-id-2': false }
  })
  likes_status: Record<string, boolean>;

  constructor(likes_status: Record<string, boolean>) {
    this.likes_status = likes_status;
  }
}

/**
 * 批量收藏状态DTO
 */
export class BatchFavoriteStatusDto {
  @ApiProperty({
    description: '媒体ID与收藏状态的映射',
    type: 'object',
    additionalProperties: { type: 'boolean' },
    example: { 'media-id-1': true, 'media-id-2': false }
  })
  favorites_status: Record<string, boolean>;

  constructor(favorites_status: Record<string, boolean>) {
    this.favorites_status = favorites_status;
  }
}
