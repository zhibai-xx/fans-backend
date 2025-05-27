import { Injectable, ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(
    private readonly databaseService: DatabaseService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { username, email, password, nickname } = registerDto;

    // 检查用户名或邮箱是否已存在
    const existingUser = await this.databaseService.user.findFirst({
      where: {
        OR: [
          { username },
          { email }
        ]
      }
    });

    if (existingUser) {
      throw new ConflictException('用户名或邮箱已被注册');
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 构建用户数据
    const userData = {
      username,
      email,
      password: hashedPassword,
    };

    // 如果昵称存在则添加到数据中
    if (nickname) {
      Object.assign(userData, { nickname });
    }

    // 创建新用户
    const user = await this.databaseService.user.create({
      data: userData
    });

    return user;
  }

  async login(loginDto: LoginDto) {
    const { username, password } = loginDto;

    const user = await this.databaseService.user.findUnique({ 
      where: { username } 
    });
    
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('密码错误');
    }

    return user;
  }

  async updateUser(id: number, updateUserDto: UpdateUserDto) {
    const user = await this.databaseService.user.findUnique({ 
      where: { id } 
    });
    
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 如果更新用户名或邮箱，需要检查是否已存在
    if (updateUserDto.username || updateUserDto.email) {
      const orConditions: Prisma.UserWhereInput[] = [];
      
      if (updateUserDto.username) {
        orConditions.push({ username: updateUserDto.username });
      }
      
      if (updateUserDto.email) {
        orConditions.push({ email: updateUserDto.email });
      }
      
      const existingUser = await this.databaseService.user.findFirst({
        where: {
          OR: orConditions,
          NOT: {
            id
          }
        }
      });

      if (existingUser) {
        throw new ConflictException('用户名或邮箱已被使用');
      }
    }

    // 更新用户信息
    const updateData: any = {};
    
    if (updateUserDto.username) updateData.username = updateUserDto.username;
    if (updateUserDto.email) updateData.email = updateUserDto.email;
    if (updateUserDto.avatar) updateData.avatar_url = updateUserDto.avatar;
    if (updateUserDto.nickname !== undefined) updateData.nickname = updateUserDto.nickname;
    if (updateUserDto.phoneNumber !== undefined) updateData.phoneNumber = updateUserDto.phoneNumber;
    
    return this.databaseService.user.update({
      where: { id },
      data: updateData
    });
  }

  async findById(id: number) {
    const user = await this.databaseService.user.findUnique({ 
      where: { id } 
    });
    
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    
    return user;
  }

  async findByUsername(username: string) {
    const user = await this.databaseService.user.findUnique({ 
      where: { username } 
    });
    
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    
    return user;
  }

  async changePassword(userId: number, changePasswordDto: ChangePasswordDto) {
    const { currentPassword, newPassword } = changePasswordDto;

    // 查找用户
    const user = await this.databaseService.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 验证当前密码
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('当前密码错误');
    }

    // 如果新密码与当前密码相同，则拒绝修改
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      throw new ConflictException('新密码不能与当前密码相同');
    }

    // 加密新密码
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // 更新密码
    return this.databaseService.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword }
    });
  }
} 