import { IsOptional, IsString, IsIn, IsInt, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class UserUploadFiltersDto {
  @IsOptional()
  @IsString()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'PRIVATE'])
  status?: string;

  @IsOptional()
  @IsString()
  @IsIn(['IMAGE', 'VIDEO'])
  media_type?: string;

  @IsOptional()
  @IsString()
  search?: string; // 标题搜索

  @IsOptional()
  @IsString()
  category_id?: string;

  @IsOptional()
  @IsString()
  @IsIn(['created_at', 'title', 'views', 'likes_count', 'reviewed_at'])
  sortBy?: string = 'created_at';

  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  sortOrder?: string = 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  page?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class UserUploadStatsDto {
  total: number;           // 总上传数
  pending: number;         // 待审核
  approved: number;        // 已通过
  rejected: number;        // 已拒绝
  private: number;         // 已暂存
  total_views: number;     // 总浏览量
  total_likes: number;     // 总点赞数
  approval_rate: number;   // 通过率（百分比）
}

export class UserUploadRecordDto {
  id: string;
  title: string;
  description?: string;
  url: string;
  thumbnail_url?: string;
  size: number;            // 文件大小（字节）
  media_type: string;      // IMAGE | VIDEO
  duration?: number;       // 视频时长（秒）
  width?: number;          // 宽度
  height?: number;         // 高度
  status: string;          // 审核状态
  review_comment?: string; // 审核备注
  reviewed_by?: number;    // 审核员ID
  reviewed_at?: Date;      // 审核时间
  reviewer?: {             // 审核员信息
    id: number;
    username: string;
    nickname?: string;
  };
  views: number;           // 浏览量
  likes_count: number;     // 点赞数
  category?: {             // 分类信息
    id: string;
    name: string;
  };
  tags: Array<{            // 标签信息
    id: string;
    name: string;
  }>;
  created_at: Date;        // 上传时间
  updated_at: Date;        // 更新时间
}

export class UserUploadListResponseDto {
  records: UserUploadRecordDto[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  stats: UserUploadStatsDto;
} 