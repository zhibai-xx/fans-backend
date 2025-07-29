import { IsString, IsOptional, IsUUID, IsEnum, IsArray, ValidateIf } from 'class-validator';
import { MediaType, MediaStatus } from '@prisma/client';
import { Transform } from 'class-transformer';

export class UpdateMediaDto {
  /**
   * 媒体标题
   * @example "我的演唱会照片"
   */
  @IsString()
  @IsOptional()
  title?: string;

  /**
   * 媒体描述
   * @example "2023年北京演唱会拍摄的照片"
   */
  @IsString()
  @IsOptional()
  description?: string;

  /**
   * 分类ID - 自动转换空字符串为undefined
   */
  @Transform(({ value }) => {
    if (value === '' || value === null) {
      return undefined;
    }
    return value;
  })
  @ValidateIf((o) => o.category_id !== undefined)
  @IsUUID()
  category_id?: string;

  /**
   * 媒体类型（图片/视频）
   * @example "IMAGE"
   */
  @IsEnum(MediaType)
  @IsOptional()
  media_type?: MediaType;

  /**
   * 媒体状态
   * @example "APPROVED"
   */
  @IsEnum(MediaStatus)
  @IsOptional()
  status?: MediaStatus;

  /**
   * 标签IDs数组
   */
  @IsArray()
  @IsUUID(4, { each: true })
  @IsOptional()
  tag_ids?: string[];
} 