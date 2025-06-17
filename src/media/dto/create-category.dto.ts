import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
  /**
   * 分类名称
   * @example "舞台照"
   */
  @ApiProperty({
    description: '分类名称',
    example: '舞台照',
    maxLength: 50
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  /**
   * 分类描述
   * @example "演唱会和舞台表演的照片"
   */
  @ApiProperty({
    description: '分类描述',
    example: '演唱会和舞台表演的照片',
    maxLength: 200,
    required: false
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  description?: string;
} 