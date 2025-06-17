import { IsString, IsNumber, IsOptional, IsArray, IsEnum, IsUUID, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

// 文件类型枚举
export enum FileType {
  IMAGE = 'image',
  VIDEO = 'video',
}

// 初始化上传DTO
export class InitUploadDto {
  @ApiProperty({ description: '文件名' })
  @IsString()
  @IsNotEmpty({ message: '文件名不能为空' })
  @MinLength(1, { message: '文件名至少需要1个字符' })
  filename: string;

  @ApiProperty({ description: '文件大小（字节）' })
  @IsNumber()
  fileSize: number;

  @ApiProperty({ description: '文件类型', enum: FileType })
  @IsEnum(FileType)
  fileType: FileType;

  @ApiProperty({ description: '文件MD5值，用于秒传和去重' })
  @IsString()
  fileMd5: string;

  @ApiProperty({ description: '分片大小（字节）', default: 5 * 1024 * 1024 })
  @IsNumber()
  @IsOptional()
  chunkSize?: number;

  @ApiProperty({ description: '文件标题' })
  @IsString()
  @IsNotEmpty({ message: '文件标题不能为空' })
  @MinLength(1, { message: '文件标题至少需要1个字符' })
  title: string;

  @ApiProperty({ description: '文件描述', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: '标签ID列表', required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagIds?: string[];

  @ApiProperty({ description: '分类ID（视频必需）', required: false })
  @IsString()
  @IsOptional()
  categoryId?: string;
}

// 上传分片DTO
export class UploadChunkDto {
  @ApiProperty({ description: '上传ID' })
  @IsUUID()
  uploadId: string;

  @ApiProperty({ description: '分片索引' })
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  chunkIndex: number;

  @ApiProperty({ description: '总分片数' })
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  totalChunks: number;
}

// 合并分片DTO
export class MergeChunksDto {
  @ApiProperty({ description: '上传ID' })
  @IsUUID()
  uploadId: string;

  @ApiProperty({ description: '文件MD5值' })
  @IsString()
  fileMd5: string;
}

// 批量上传初始化DTO
export class BatchInitUploadDto {
  @ApiProperty({ description: '文件列表' })
  files: InitUploadDto[];
}

// 上传进度响应
export class UploadProgressResponse {
  @ApiProperty({ description: '上传ID' })
  uploadId: string;

  @ApiProperty({ description: '已上传的分片索引列表' })
  uploadedChunks: number[];

  @ApiProperty({ description: '上传进度百分比' })
  progress: number;

  @ApiProperty({ description: '上传状态' })
  status: 'pending' | 'uploading' | 'completed' | 'failed';
}

// 初始化上传响应
export class InitUploadResponse {
  @ApiProperty({ description: '上传ID' })
  uploadId: string;

  @ApiProperty({ description: '是否需要上传（false表示秒传）' })
  needUpload: boolean;

  @ApiProperty({ description: '已存在的分片索引（断点续传）' })
  uploadedChunks: number[];

  @ApiProperty({ description: '媒体ID（秒传时返回）' })
  mediaId?: string;
} 