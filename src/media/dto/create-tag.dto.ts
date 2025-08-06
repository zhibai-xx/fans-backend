import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreateTagDto {
  /**
   * 标签名称
   * @example "演唱会"
   */
  @ApiProperty({
    description: '标签名称',
    example: '演唱会',
    maxLength: 30
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  name: string;
}

export class UpdateTagDto extends PartialType(CreateTagDto) { }

export class CreateCategoryDto {
  /**
   * 分类名称
   * @example "舞台表演"
   */
  @ApiProperty({
    description: '分类名称',
    example: '舞台表演',
    maxLength: 50
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  /**
   * 分类描述
   * @example "演唱会、音乐节等舞台表演的照片和视频"
   */
  @ApiProperty({
    description: '分类描述',
    example: '演唱会、音乐节等舞台表演的照片和视频',
    maxLength: 200,
    required: false
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  description?: string;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) { } 