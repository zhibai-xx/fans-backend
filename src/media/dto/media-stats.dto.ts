import { ApiProperty } from '@nestjs/swagger';

/**
 * 媒体统计信息DTO
 */
export class MediaStatsDto {
  @ApiProperty({ description: '媒体ID' })
  media_id: string;

  @ApiProperty({ description: '媒体标题' })
  title: string;

  @ApiProperty({ description: '观看次数' })
  views: number;

  @ApiProperty({ description: '点赞数' })
  likes_count: number;

  @ApiProperty({ description: '收藏数' })
  favorites_count: number;

  @ApiProperty({ description: '评论数' })
  comments_count: number;

  @ApiProperty({ description: '互动率（点赞+收藏+评论）/观看次数' })
  engagement_rate: number;

  constructor(data: any) {
    this.media_id = data.id;
    this.title = data.title;
    this.views = data.views || 0;
    this.likes_count = data.likes_count || 0;
    this.favorites_count = data.favorites_count || 0;
    this.comments_count = data._count?.comments || 0;

    // 计算互动率
    const totalInteractions = this.likes_count + this.favorites_count + this.comments_count;
    this.engagement_rate = this.views > 0 ? Number((totalInteractions / this.views * 100).toFixed(2)) : 0;
  }
}

/**
 * 全站统计信息DTO
 */
export class GlobalStatsDto {
  @ApiProperty({ description: '总媒体数' })
  total_media: number;

  @ApiProperty({ description: '总观看次数' })
  total_views: number;

  @ApiProperty({ description: '总点赞数' })
  total_likes: number;

  @ApiProperty({ description: '总收藏数' })
  total_favorites: number;

  @ApiProperty({ description: '总评论数' })
  total_comments: number;

  @ApiProperty({ description: '活跃用户数（有过互动的用户）' })
  active_users: number;

  @ApiProperty({ description: '平均互动率' })
  avg_engagement_rate: number;

  constructor(data: any) {
    this.total_media = data.total_media || 0;
    this.total_views = data.total_views || 0;
    this.total_likes = data.total_likes || 0;
    this.total_favorites = data.total_favorites || 0;
    this.total_comments = data.total_comments || 0;
    this.active_users = data.active_users || 0;

    // 计算平均互动率
    const totalInteractions = this.total_likes + this.total_favorites + this.total_comments;
    this.avg_engagement_rate = this.total_views > 0 ? Number((totalInteractions / this.total_views * 100).toFixed(2)) : 0;
  }
}

/**
 * 用户统计信息DTO
 */
export class UserStatsDto {
  @ApiProperty({ description: '用户UUID' })
  user_uuid: string;

  @ApiProperty({ description: '用户名' })
  username: string;

  @ApiProperty({ description: '上传媒体数' })
  uploaded_media: number;

  @ApiProperty({ description: '获得点赞数' })
  received_likes: number;

  @ApiProperty({ description: '获得收藏数' })
  received_favorites: number;

  @ApiProperty({ description: '发出点赞数' })
  given_likes: number;

  @ApiProperty({ description: '发出收藏数' })
  given_favorites: number;

  @ApiProperty({ description: '评论数' })
  comments_count: number;

  constructor(data: any, userUuid: string) {
    this.user_uuid = userUuid;
    this.username = data.username;
    this.uploaded_media = data._count?.uploaded_media || 0;
    this.received_likes = data.uploaded_media?.reduce((sum: number, media: any) => sum + (media.likes_count || 0), 0) || 0;
    this.received_favorites = data.uploaded_media?.reduce((sum: number, media: any) => sum + (media.favorites_count || 0), 0) || 0;
    this.given_likes = data._count?.likes || 0;
    this.given_favorites = data._count?.favorites || 0;
    this.comments_count = data._count?.comments || 0;
  }
}

/**
 * 时间段统计DTO
 */
export class PeriodStatsDto {
  @ApiProperty({ description: '日期' })
  date: string;

  @ApiProperty({ description: '新增媒体数' })
  new_media: number;

  @ApiProperty({ description: '新增点赞数' })
  new_likes: number;

  @ApiProperty({ description: '新增收藏数' })
  new_favorites: number;

  @ApiProperty({ description: '新增评论数' })
  new_comments: number;

  @ApiProperty({ description: '观看次数' })
  views: number;

  constructor(data: any) {
    this.date = data.date;
    this.new_media = data.new_media || 0;
    this.new_likes = data.new_likes || 0;
    this.new_favorites = data.new_favorites || 0;
    this.new_comments = data.new_comments || 0;
    this.views = data.views || 0;
  }
}

/**
 * 统计查询参数DTO
 */
export class StatsQueryDto {
  @ApiProperty({ description: '开始日期', required: false, example: '2024-01-01' })
  start_date?: string;

  @ApiProperty({ description: '结束日期', required: false, example: '2024-12-31' })
  end_date?: string;

  @ApiProperty({ description: '统计类型', required: false, enum: ['daily', 'weekly', 'monthly'], default: 'daily' })
  period?: 'daily' | 'weekly' | 'monthly' = 'daily';

  @ApiProperty({ description: '限制结果数量', required: false, default: 30 })
  limit?: number = 30;
}
