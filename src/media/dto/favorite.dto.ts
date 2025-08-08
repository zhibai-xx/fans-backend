import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';

/**
 * 收藏媒体DTO
 */
export class CreateFavoriteDto {
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
 * 收藏记录响应DTO
 */
export class FavoriteResponseDto {
  @ApiProperty({ description: '收藏记录ID' })
  id: string;

  @ApiProperty({ description: '媒体ID' })
  media_id: string;

  @ApiProperty({ description: '用户UUID' })
  user_uuid: string;

  @ApiProperty({ description: '收藏时间' })
  @Transform(({ value }) => value ? new Date(value).toISOString() : new Date().toISOString())
  created_at: string;

  constructor(favorite: any, userUuid: string) {
    this.id = favorite.id;
    this.media_id = favorite.media_id;
    this.user_uuid = userUuid;
    this.created_at = favorite.created_at;
  }
}

/**
 * 收藏状态DTO
 */
export class FavoriteStatusDto {
  @ApiProperty({ description: '是否已收藏' })
  is_favorited: boolean;

  @ApiProperty({ description: '收藏总数' })
  favorites_count: number;

  constructor(is_favorited: boolean, favorites_count: number) {
    this.is_favorited = is_favorited;
    this.favorites_count = favorites_count;
  }
}

/**
 * 用户收藏列表查询DTO
 */
export class FavoriteListQueryDto {
  @ApiProperty({ description: '页码', required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ description: '每页数量', required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

/**
 * 用户收藏列表响应DTO
 */
export class FavoriteListResponseDto {
  @ApiProperty({ description: '收藏记录列表', type: [FavoriteResponseDto] })
  data: FavoriteResponseDto[];

  @ApiProperty({ description: '分页信息' })
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };

  constructor(data: FavoriteResponseDto[], pagination: any) {
    this.data = data;
    this.pagination = pagination;
  }
}
