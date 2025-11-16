import { ApiPropertyOptional } from '@nestjs/swagger';
import { MediaType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class IncrementViewDto {
  @ApiPropertyOptional({
    description: '匿名会话ID，用于去重',
    example: 'sess_1234567890',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sessionId?: string;

  @ApiPropertyOptional({
    description: '媒体类型',
    enum: MediaType,
  })
  @IsOptional()
  @IsEnum(MediaType)
  mediaType?: MediaType;

  @ApiPropertyOptional({
    description: '事件类型，例如 play/detail',
    example: 'play',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  event?: string;
}
