import { IsEmail, IsEnum, IsNotEmpty, IsString } from "class-validator";

export class CreateUserDto {
    @IsString()
    @IsNotEmpty()
    name: string;  // 用户名，必须是非空字符串

    @IsEmail()
    email: string;  // 用户邮箱，必须是有效的邮箱格式

    @IsEnum(['ADMIN', 'INTERN', 'ENGINEER'], {
        message: 'Valid role required'  // 自定义错误消息
    })
    role: 'ADMIN' | 'INTERN' | 'ENGINEER'  // 用户角色，必须是指定枚举值之一
}