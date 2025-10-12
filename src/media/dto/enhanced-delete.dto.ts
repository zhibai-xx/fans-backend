import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class EnhancedDeleteDto {
  @ApiProperty({ description: '媒体ID数组' })
  @IsArray()
  @IsString({ each: true })
  mediaIds: string[];

  @ApiProperty({ description: '是否强制删除（跳过某些验证）', required: false })
  @IsOptional()
  @IsBoolean()
  forceDelete?: boolean;

  @ApiProperty({ description: '删除原因', required: false })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ description: '是否创建备份', required: false, default: true })
  @IsOptional()
  @IsBoolean()
  createBackup?: boolean = true;
}

export class SoftDeleteDto {
  @ApiProperty({ description: '媒体ID数组' })
  @IsArray()
  @IsString({ each: true })
  mediaIds: string[];

  @ApiProperty({ description: '删除原因' })
  @IsString()
  reason: string;

  @ApiProperty({ description: '计划硬删除时间（天数）', required: false, default: 30 })
  @IsOptional()
  scheduledDeletionDays?: number = 30;
}

export interface DeletionResult {
  success: boolean;
  mediaId: string;
  message: string;
  filesDeleted: {
    mainFile: boolean;
    thumbnail: boolean;
    processedFiles: boolean;
    qualityFiles: number;
  };
  backupCreated?: boolean;
  error?: string;
}

export interface DeletionSummary {
  totalRequested: number;
  successfulDeletions: number;
  failedDeletions: number;
  filesCleanedUp: number;
  spaceFree: number; // bytes
  results: DeletionResult[];
}
