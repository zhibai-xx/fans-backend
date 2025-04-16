import { Injectable, ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(
    private readonly databaseService: DatabaseService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { username, email, password } = registerDto;

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

    // 创建新用户
    const user = await this.databaseService.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
      }
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
    const updateData: Prisma.UserUpdateInput = {};
    
    if (updateUserDto.username) updateData.username = updateUserDto.username;
    if (updateUserDto.email) updateData.email = updateUserDto.email;
    if (updateUserDto.avatar) updateData.avatar_url = updateUserDto.avatar;
    
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
} 