import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: '刷新令牌' })
  @IsNotEmpty({ message: 'refresh_token 不能为空' })
  @IsString({ message: 'refresh_token 必须是字符串' })
  refresh_token: string;
}
