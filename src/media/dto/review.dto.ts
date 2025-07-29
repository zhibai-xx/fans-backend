import { IsString, IsOptional, IsArray, IsUUID, IsEnum, IsInt, Min } from 'class-validator';
import { MediaStatus, MediaType } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

// 批量状态更新DTO
export class BatchUpdateStatusDto {
  @ApiProperty({ description: '媒体ID数组', type: [String] })
  @IsArray()
  @IsUUID(4, { each: true })
  mediaIds: string[];

  @ApiProperty({ description: '新状态', enum: MediaStatus })
  @IsEnum(MediaStatus)
  status: MediaStatus;

  @ApiProperty({ description: '审核备注', required: false })
  @IsOptional()
  @IsString()
  note?: string;
}

// 批量标签操作DTO
export class BatchUpdateTagsDto {
  @ApiProperty({ description: '媒体ID数组', type: [String] })
  @IsArray()
  @IsUUID(4, { each: true })
  mediaIds: string[];

  @ApiProperty({ description: '标签ID数组', type: [String] })
  @IsArray()
  @IsUUID(4, { each: true })
  tagIds: string[];

  @ApiProperty({ description: '操作类型：add（添加）或replace（替换）', enum: ['add', 'replace'] })
  @IsEnum(['add', 'replace'])
  action: 'add' | 'replace';
}

// 批量分类更新DTO
export class BatchUpdateCategoryDto {
  @ApiProperty({ description: '媒体ID数组', type: [String] })
  @IsArray()
  @IsUUID(4, { each: true })
  mediaIds: string[];

  @ApiProperty({ description: '分类ID', required: false })
  @IsOptional()
  @IsUUID(4)
  categoryId?: string;
}

// 审核筛选DTO
export class ReviewFilterDto {
  @ApiProperty({ description: '媒体类型', enum: MediaType, required: false })
  @IsOptional()
  @IsEnum(MediaType)
  type?: MediaType;

  @ApiProperty({ description: '状态', enum: MediaStatus, required: false })
  @IsOptional()
  @IsEnum(MediaStatus)
  status?: MediaStatus;

  @ApiProperty({ description: '分类ID', required: false })
  @IsOptional()
  @IsUUID(4)
  categoryId?: string;

  @ApiProperty({ description: '标签ID', required: false })
  @IsOptional()
  @IsUUID(4)
  tagId?: string;

  @ApiProperty({ description: '用户UUID', required: false })
  @IsOptional()
  @IsString()
  userUuid?: string;

  @ApiProperty({ description: '搜索关键词', required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ description: '排序字段', enum: ['created_at', 'views', 'likes_count', 'size'], required: false, default: 'created_at' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    // 只允许安全的排序字段，防止SQL注入
    const allowedFields = ['created_at', 'views', 'likes_count', 'size', 'updated_at'];
    if (typeof value === 'string' && allowedFields.includes(value)) {
      return value;
    }
    return 'created_at'; // 默认值
  })
  sortBy?: string;

  @ApiProperty({ description: '排序方向', enum: ['asc', 'desc'], required: false, default: 'desc' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    // 只允许asc或desc
    if (typeof value === 'string' && (value === 'asc' || value === 'desc')) {
      return value;
    }
    return 'desc'; // 默认值
  })
  sortOrder?: string;

  @ApiProperty({ description: '跳过条数', minimum: 0, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Transform(({ value }) => parseInt(value))
  skip?: number;

  @ApiProperty({ description: '获取条数', minimum: 1, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value))
  take?: number;
}

// 审核统计响应DTO
export class ReviewStatsDto {
  @ApiProperty({ description: '总媒体数' })
  total: number;

  @ApiProperty({ description: '待审核数量' })
  pending: number;

  @ApiProperty({ description: '已通过数量' })
  approved: number;

  @ApiProperty({ description: '已拒绝数量' })
  rejected: number;

  @ApiProperty({ description: '私有状态数量' })
  private: number;

  @ApiProperty({ description: '图片数量' })
  images: number;

  @ApiProperty({ description: '视频数量' })
  videos: number;

  @ApiProperty({ description: '今日待审核数量' })
  todayPending: number;

  @ApiProperty({ description: '今日已审核数量' })
  todayReviewed: number;

  constructor(data: any) {
    this.total = data.total || 0;
    this.pending = data.pending || 0;
    this.approved = data.approved || 0;
    this.rejected = data.rejected || 0;
    this.private = data.private || 0;
    this.images = data.images || 0;
    this.videos = data.videos || 0;
    this.todayPending = data.todayPending || 0;
    this.todayReviewed = data.todayReviewed || 0;
  }
}

// 批量操作结果DTO
export class BatchOperationResultDto {
  @ApiProperty({ description: '成功处理的数量' })
  successCount: number;

  @ApiProperty({ description: '失败处理的数量' })
  failureCount: number;

  @ApiProperty({ description: '成功处理的媒体ID列表', type: [String] })
  successIds: string[];

  @ApiProperty({ description: '失败处理的媒体ID列表', type: [String] })
  failureIds: string[];

  @ApiProperty({ description: '错误信息列表', type: [String] })
  errors: string[];

  constructor(successIds: string[], failureIds: string[], errors: string[]) {
    this.successCount = successIds.length;
    this.failureCount = failureIds.length;
    this.successIds = successIds;
    this.failureIds = failureIds;
    this.errors = errors;
  }
} 