import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export type CommentSortOption = 'hot' | 'latest';

interface CommentUserShape {
  uuid: string;
  username: string;
  avatar_url?: string | null;
}

interface CommentReplyShape {
  id: string;
  media_id: string;
  parent_id: string | null;
  content: string;
  created_at: Date;
  updated_at: Date;
  user: CommentUserShape;
}

interface CommentShape extends CommentReplyShape {
  replies?: CommentReplyShape[];
  _count?: {
    replies: number;
  };
}

export class CommentAuthorDto {
  @ApiProperty({ description: '用户UUID' })
  uuid: string;

  @ApiProperty({ description: '用户名' })
  username: string;

  @ApiPropertyOptional({ description: '头像URL' })
  avatar_url?: string;

  constructor(user: CommentUserShape) {
    this.uuid = user.uuid;
    this.username = user.username;
    this.avatar_url = user.avatar_url ?? undefined;
  }
}

export class CommentReplyPreviewDto {
  @ApiProperty({ description: '留言ID' })
  id: string;

  @ApiProperty({ description: '媒体ID' })
  media_id: string;

  @ApiPropertyOptional({ description: '父级留言ID' })
  parent_id?: string | null;

  @ApiProperty({ description: '留言内容' })
  content: string;

  @ApiProperty({ description: '作者信息', type: CommentAuthorDto })
  author: CommentAuthorDto;

  @ApiProperty({ description: '创建时间 (ISO)' })
  @Transform(({ value }) => new Date(value).toISOString())
  created_at: string;

  @ApiProperty({ description: '更新时间 (ISO)' })
  @Transform(({ value }) => new Date(value).toISOString())
  updated_at: string;

  constructor(comment: CommentReplyShape) {
    this.id = comment.id;
    this.media_id = comment.media_id;
    this.parent_id = comment.parent_id;
    this.content = comment.content;
    this.author = new CommentAuthorDto(comment.user);
    this.created_at = comment.created_at.toISOString();
    this.updated_at = comment.updated_at.toISOString();
  }
}

export class CommentResponseDto extends CommentReplyPreviewDto {
  @ApiProperty({ description: '直接回复数量' })
  replies_count: number;

  @ApiProperty({
    description: '部分回复预览（按时间升序）',
    type: [CommentReplyPreviewDto],
  })
  replies_preview: CommentReplyPreviewDto[];

  @ApiProperty({ description: '是否存在更多回复' })
  has_more_replies: boolean;

  constructor(comment: CommentShape) {
    super(comment);
    const repliesCount = comment._count?.replies ?? 0;
    const preview = (comment.replies ?? []).map(
      (reply) => new CommentReplyPreviewDto(reply),
    );

    this.replies_count = repliesCount;
    this.replies_preview = preview;
    this.has_more_replies = repliesCount > preview.length;
  }
}

export class CommentListResponseDto {
  @ApiProperty({ description: '请求是否成功' })
  success: boolean;

  @ApiProperty({
    description: '留言列表',
    type: [CommentResponseDto],
  })
  data: CommentResponseDto[];

  @ApiProperty({
    description: '分页信息',
  })
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };

  constructor(
    data: CommentResponseDto[],
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    },
  ) {
    this.success = true;
    this.data = data;
    this.pagination = pagination;
  }
}

export class CreateCommentDto {
  @ApiProperty({
    description: '留言内容',
    maxLength: 500,
    example: '好喜欢这段花絮！',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  content: string;

  @ApiPropertyOptional({
    description: '父级留言ID，留空表示顶级留言',
  })
  @IsUUID()
  @IsOptional()
  parent_id?: string;
}

export class CommentListQueryDto {
  @ApiPropertyOptional({ description: '分页页码', minimum: 1, default: 1 })
  @Transform(({ value }) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量', minimum: 1, maximum: 50, default: 20 })
  @Transform(({ value }) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 20;
    }
    return Math.min(Math.floor(parsed), 50);
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({
    description: '排序方式',
    enum: ['hot', 'latest'],
    default: 'hot',
  })
  @IsIn(['hot', 'latest'])
  @IsOptional()
  sort?: CommentSortOption = 'hot';

  @ApiPropertyOptional({
    name: 'parentId',
    description: '指定父级留言ID时返回其直接回复',
  })
  @IsUUID()
  @IsOptional()
  parentId?: string;
}
