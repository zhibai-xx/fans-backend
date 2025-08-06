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
  ) { }

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

  async findByUuid(uuid: string) {
    const user = await this.databaseService.user.findUnique({
      where: { uuid }
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

  // =====================================
  // 管理员专用方法
  // =====================================

  /**
   * 获取所有用户（管理员专用，带分页和筛选）
   */
  async getAllUsersForAdmin(filters: {
    page: number;
    limit: number;
    search?: string;
    role?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const { page, limit, search, role, status, sortBy = 'created_at', sortOrder = 'desc' } = filters;

    // 构建查询条件
    const where: any = {};

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { nickname: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (role) {
      where.role = role;
    }

    if (status) {
      where.status = status;
    }

    const skip = (page - 1) * limit;

    // 获取总数
    const total = await this.databaseService.user.count({ where });

    // 获取用户列表
    const users = await this.databaseService.user.findMany({
      where,
      select: {
        id: true,
        uuid: true,
        username: true,
        email: true,
        nickname: true,
        role: true,
        status: true,
        phoneNumber: true,
        avatar_url: true,
        created_at: true,
        updated_at: true,
        _count: {
          select: {
            uploaded_media: true,
            comments: true,
            favorites: true
          }
        }
      },
      orderBy: {
        [sortBy]: sortOrder
      },
      skip,
      take: limit
    });

    return {
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * 根据ID获取用户详情（带统计数据）
   */
  async findByIdWithStats(id: number) {
    const user = await this.databaseService.user.findUnique({
      where: { id },
      select: {
        id: true,
        uuid: true,
        username: true,
        email: true,
        nickname: true,
        role: true,
        status: true,
        phoneNumber: true,
        avatar_url: true,
        created_at: true,
        updated_at: true,
        _count: {
          select: {
            uploaded_media: true,
            comments: true,
            favorites: true,
            operation_logs: true,
            login_logs: true
          }
        }
      }
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return user;
  }

  /**
   * 更新用户状态
   */
  async updateUserStatus(id: number, status: 'ACTIVE' | 'SUSPENDED') {
    const user = await this.databaseService.user.findUnique({
      where: { id }
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return this.databaseService.user.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        uuid: true,
        username: true,
        email: true,
        nickname: true,
        role: true,
        status: true,
        phoneNumber: true,
        avatar_url: true,
        created_at: true,
        updated_at: true
      }
    });
  }

  /**
   * 更新用户角色
   */
  async updateUserRole(id: number, role: 'USER' | 'ADMIN') {
    const user = await this.databaseService.user.findUnique({
      where: { id }
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 防止降级最后一个管理员
    if (role === 'USER' && user.role === 'ADMIN') {
      const adminCount = await this.databaseService.user.count({
        where: { role: 'ADMIN' }
      });

      if (adminCount <= 1) {
        throw new ConflictException('至少需要保留一个管理员账户');
      }
    }

    return this.databaseService.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        uuid: true,
        username: true,
        email: true,
        nickname: true,
        role: true,
        status: true,
        phoneNumber: true,
        avatar_url: true,
        created_at: true,
        updated_at: true
      }
    });
  }

  /**
   * 管理员更新用户基本信息
   */
  async updateUserByAdmin(id: number, updateData: {
    username?: string;
    email?: string;
    nickname?: string;
    phoneNumber?: string;
  }) {
    const user = await this.databaseService.user.findUnique({
      where: { id }
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 检查用户名和邮箱是否重复（排除当前用户）
    if (updateData.username || updateData.email) {
      const existingUser = await this.databaseService.user.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                updateData.username ? { username: updateData.username } : {},
                updateData.email ? { email: updateData.email } : {}
              ].filter(obj => Object.keys(obj).length > 0)
            }
          ]
        }
      });

      if (existingUser) {
        throw new ConflictException('用户名或邮箱已被使用');
      }
    }

    return this.databaseService.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        uuid: true,
        username: true,
        email: true,
        nickname: true,
        role: true,
        status: true,
        phoneNumber: true,
        avatar_url: true,
        created_at: true,
        updated_at: true
      }
    });
  }

  /**
   * 获取用户统计概览
   */
  async getUserStatsOverview() {
    // 获取今天的开始时间（00:00:00）
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // 获取7天前的开始时间
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      adminUsers,
      regularUsers,
      todayUsers,  // 今日新增用户数
      recentUsers  // 最近7天新增用户数
    ] = await Promise.all([
      // 总用户数
      this.databaseService.user.count(),
      // 活跃用户数
      this.databaseService.user.count({ where: { status: 'ACTIVE' } }),
      // 暂停用户数
      this.databaseService.user.count({ where: { status: 'SUSPENDED' } }),
      // 管理员数
      this.databaseService.user.count({ where: { role: 'ADMIN' } }),
      // 普通用户数
      this.databaseService.user.count({ where: { role: 'USER' } }),
      // 今日注册用户数（从今天00:00:00开始）
      this.databaseService.user.count({
        where: {
          created_at: {
            gte: todayStart
          }
        }
      }),
      // 最近7天注册用户数
      this.databaseService.user.count({
        where: {
          created_at: {
            gte: weekStart
          }
        }
      })
    ]);

    return {
      totalUsers,
      activeUsers,
      suspendedUsers,
      adminUsers,
      regularUsers,
      todayUsers,   // 新增：今日用户数
      recentUsers,  // 保持：7天内用户数
      statusDistribution: {
        active: activeUsers,
        suspended: suspendedUsers
      },
      roleDistribution: {
        admin: adminUsers,
        user: regularUsers
      }
    };
  }
} 