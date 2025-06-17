import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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