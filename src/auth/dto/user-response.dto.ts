import { ApiProperty } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';

const DEFAULT_AVATAR_URL = '/api/upload/file/avatars/default.webp';

type UserResponseInput = {
  id: number;
  uuid: string;
  username: string;
  email: string;
  nickname?: string | null;
  avatar_url?: string | null;
  phoneNumber?: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: Date;
  updated_at: Date;
};

type PublicUserResponseInput = {
  uuid: string;
  username: string;
  nickname?: string | null;
  avatar_url?: string | null;
  role: UserRole;
  created_at: Date;
};

const normalizeAvatarUrl = (avatarUrl?: string | null) => {
  if (!avatarUrl || avatarUrl === DEFAULT_AVATAR_URL) {
    return undefined;
  }
  return avatarUrl;
};

export class UserResponseDto {
  @ApiProperty({ description: '用户ID（内部标识）' })
  id: number;

  @ApiProperty({ description: '用户UUID（外部标识）' })
  uuid: string;

  @ApiProperty({ description: '用户名' })
  username: string;

  @ApiProperty({ description: '邮箱' })
  email: string;

  @ApiProperty({ description: '昵称', required: false })
  nickname?: string;

  @ApiProperty({ description: '头像URL', required: false })
  avatar_url?: string;

  @ApiProperty({ description: '手机号', required: false })
  phoneNumber?: string;

  @ApiProperty({ description: '用户角色', enum: UserRole })
  role: UserRole;

  @ApiProperty({ description: '用户状态', enum: UserStatus })
  status: UserStatus;

  @ApiProperty({ description: '创建时间' })
  created_at: Date;

  @ApiProperty({ description: '更新时间' })
  updated_at: Date;

  constructor(user: UserResponseInput) {
    this.id = user.id;
    this.uuid = user.uuid;
    this.username = user.username;
    this.email = user.email;
    this.nickname = user.nickname ?? undefined;
    this.avatar_url = normalizeAvatarUrl(user.avatar_url);
    this.phoneNumber = user.phoneNumber ?? undefined;
    this.role = user.role;
    this.status = user.status;
    this.created_at = user.created_at;
    this.updated_at = user.updated_at;
  }
}

export class PublicUserResponseDto {
  @ApiProperty({ description: '用户UUID（外部标识）' })
  uuid: string;

  @ApiProperty({ description: '用户名' })
  username: string;

  @ApiProperty({ description: '昵称', required: false })
  nickname?: string;

  @ApiProperty({ description: '头像URL', required: false })
  avatar_url?: string;

  @ApiProperty({ description: '用户角色', enum: UserRole })
  role: UserRole;

  @ApiProperty({ description: '创建时间' })
  created_at: Date;

  constructor(user: PublicUserResponseInput) {
    this.uuid = user.uuid;
    this.username = user.username;
    this.nickname = user.nickname ?? undefined;
    this.avatar_url = normalizeAvatarUrl(user.avatar_url);
    this.role = user.role;
    this.created_at = user.created_at;
  }
}
