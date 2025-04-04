import { IsEmail, IsEnum, IsNotEmpty, IsString, IsOptional, MinLength, Matches } from "class-validator";
import { UserRole, UserStatus } from '@prisma/client';

export class CreateUserDto {
    @IsString()
    @IsNotEmpty()
    username: string;  // 用户名，必须是非空字符串

    @IsEmail()
    @IsNotEmpty()
    email: string;  // 用户邮箱，必须是有效的邮箱格式

    @IsString()
    @IsNotEmpty()
    @MinLength(8, { message: '密码至少8位' })
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/, {
        message: '密码需包含大小写字母和数字',
    })
    password: string;

    @IsString()
    @IsOptional() // 允许字段为空
    phoneNumber?: string;

    @IsString()
    @IsOptional() // 允许字段为空
    avatar_url?: string;

    @IsEnum(UserRole, {
        message: 'Valid role required'  // 自定义错误消息
    })
    role: UserRole  // 用户角色，必须是指定枚举值之一

    //(['ACTIVE', 'SUSPENDED'],
    @IsEnum(UserStatus, {
        message: 'Valid status required'
    })
    status: UserStatus
}