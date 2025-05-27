import { IsEmail, IsOptional, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiProperty({ description: '用户名', example: 'user123', required: false })
  @IsOptional()
  @IsString({ message: '用户名必须是字符串' })
  @MinLength(3, { message: '用户名长度不能少于3个字符' })
  @MaxLength(20, { message: '用户名长度不能超过20个字符' })
  username?: string;

  @ApiProperty({ description: '邮箱', example: 'user@example.com', required: false })
  @IsOptional()
  @IsEmail({}, { message: '邮箱格式不正确' })
  email?: string;

  @ApiProperty({ description: '头像', example: 'https://example.com/avatar.jpg', required: false })
  @IsOptional()
  @IsString({ message: '头像必须是字符串' })
  avatar?: string;

  // @ApiProperty({ description: '个人简介', example: '这是我的个人简介', required: false })
  // @IsOptional()
  // @IsString({ message: '个人简介必须是字符串' })
  // @MaxLength(200, { message: '个人简介长度不能超过200个字符' })
  // bio?: string;

  @ApiProperty({ description: '昵称', example: '这是我的昵称', required: false })
  @IsOptional()
  @IsString({ message: '昵称必须是字符串' })
  @MaxLength(20, { message: '昵称长度不能超过20个字符' })
  nickname?: string;

  @ApiProperty({ description: '手机号码', example: '1**********', required: false })
  @IsOptional()
  @IsString({ message: '手机号码必须是字符串' })
  phoneNumber?: string;
} 