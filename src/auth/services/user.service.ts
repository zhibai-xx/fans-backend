import {
  Injectable,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from 'src/database/database.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import * as bcrypt from 'bcrypt';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import * as path from 'path';
import { promises as fsPromises } from 'fs';
import * as Sharp from 'sharp';

type SharpModule = typeof import('sharp');
type SharpModuleWithDefault = { default?: SharpModule };

const resolveSharpModule = (
  module: SharpModule | SharpModuleWithDefault,
): SharpModule => {
  if (typeof module === 'function') {
    return module;
  }
  if (module.default && typeof module.default === 'function') {
    return module.default;
  }
  return module as SharpModule;
};
const sharp: SharpModule = resolveSharpModule(
  Sharp as SharpModule | SharpModuleWithDefault,
);

const AVATAR_API_PREFIX = '/api/upload/file/avatars';
const DEFAULT_AVATAR_URL = `${AVATAR_API_PREFIX}/default.webp`;
const ALLOWED_AVATAR_MIME = ['image/jpeg', 'image/png', 'image/webp'];
export const AVATAR_MAX_SIZE = 2 * 1024 * 1024; // 2MB

const toUserRole = (role?: string): UserRole | undefined => {
  if (!role) {
    return undefined;
  }
  return (Object.values(UserRole) as string[]).includes(role)
    ? (role as UserRole)
    : undefined;
};

const toUserStatus = (status?: string): UserStatus | undefined => {
  if (!status) {
    return undefined;
  }
  return (Object.values(UserStatus) as string[]).includes(status)
    ? (status as UserStatus)
    : undefined;
};

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private readonly uploadRoot: string;
  private readonly avatarDir: string;
  private readonly avatarDirReady: Promise<void>;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {
    const configuredUploadRoot =
      this.configService.get<string>('UPLOAD_DIR') ||
      path.resolve(__dirname, '../../../../uploads');

    this.uploadRoot = path.isAbsolute(configuredUploadRoot)
      ? configuredUploadRoot
      : path.resolve(process.cwd(), configuredUploadRoot);
    this.avatarDir = path.join(this.uploadRoot, 'avatars');
    this.avatarDirReady = this.ensureAvatarDirectory();
  }

  async register(registerDto: RegisterDto) {
    const { username, email, password, nickname } = registerDto;

    // 检查用户名或邮箱是否已存在
    const existingUser = await this.databaseService.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });

    if (existingUser) {
      throw new ConflictException('用户名或邮箱已被注册');
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 构建用户数据
    const userData: Prisma.UserCreateInput = {
      username,
      email,
      password: hashedPassword,
      avatar_url: null,
    };

    // 如果昵称存在则添加到数据中
    if (nickname) {
      Object.assign(userData, { nickname });
    }

    // 创建新用户
    const user = await this.databaseService.user.create({
      data: userData,
    });

    return user;
  }

  async login(loginDto: LoginDto) {
    const { username, password } = loginDto;

    const user = await this.databaseService.user.findUnique({
      where: { username },
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

  async bumpSessionVersion(userId: number) {
    return this.databaseService.user.update({
      where: { id: userId },
      data: {
        session_version: {
          increment: 1,
        },
      },
    });
  }

  async updateUser(id: number, updateUserDto: UpdateUserDto) {
    const user = await this.databaseService.user.findUnique({
      where: { id },
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
            id,
          },
        },
      });

      if (existingUser) {
        throw new ConflictException('用户名或邮箱已被使用');
      }
    }

    // 更新用户信息
    const updateData: Prisma.UserUpdateInput = {};

    if (updateUserDto.username) updateData.username = updateUserDto.username;
    if (updateUserDto.email) updateData.email = updateUserDto.email;
    if (updateUserDto.nickname !== undefined)
      updateData.nickname = updateUserDto.nickname;
    if (updateUserDto.phoneNumber !== undefined)
      updateData.phoneNumber = updateUserDto.phoneNumber;

    return this.databaseService.user.update({
      where: { id },
      data: updateData,
    });
  }

  async findById(id: number) {
    const user = await this.databaseService.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return user;
  }

  async findByUuid(uuid: string) {
    const user = await this.databaseService.user.findUnique({
      where: { uuid },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return user;
  }

  async findByUsername(username: string) {
    const user = await this.databaseService.user.findUnique({
      where: { username },
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
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 验证当前密码
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
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
      data: { password: hashedNewPassword },
    });
  }

  async updateAvatar(userId: number, file: Express.Multer.File) {
    await this.avatarDirReady;

    if (!file) {
      throw new BadRequestException('请上传头像文件');
    }

    if (file.size > AVATAR_MAX_SIZE) {
      throw new BadRequestException('头像大小不能超过 2MB');
    }

    if (!ALLOWED_AVATAR_MIME.includes(file.mimetype)) {
      throw new BadRequestException('仅支持 JPG、PNG 或 WebP 格式的头像');
    }

    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const versionSuffix = Date.now();
    const fileName = `${user.uuid || user.id}_${versionSuffix}.webp`;
    const filePath = path.join(this.avatarDir, fileName);

    try {
      await sharp(file.buffer)
        .rotate()
        .resize(512, 512, { fit: sharp.fit.cover })
        .toFormat('webp', { quality: 85 })
        .toFile(filePath);
    } catch (error) {
      this.logger.error(
        `头像处理失败: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException('头像处理失败，请稍后重试');
    }

    if (
      user.avatar_url &&
      user.avatar_url !== DEFAULT_AVATAR_URL &&
      user.avatar_url !== `${AVATAR_API_PREFIX}/${fileName}`
    ) {
      await this.removeAvatarFile(user.avatar_url);
    }

    const avatarUrl = `${AVATAR_API_PREFIX}/${fileName}`;

    return this.databaseService.user.update({
      where: { id: userId },
      data: { avatar_url: avatarUrl },
    });
  }

  private async ensureAvatarDirectory() {
    try {
      await fsPromises.mkdir(this.avatarDir, { recursive: true });
      const defaultPath = path.join(this.avatarDir, 'default.webp');
      try {
        await fsPromises.access(defaultPath);
      } catch {
        await sharp({
          create: {
            width: 256,
            height: 256,
            channels: 4,
            background: { r: 229, g: 231, b: 235, alpha: 1 },
          },
        })
          .webp({ quality: 90 })
          .toFile(defaultPath);
      }
    } catch (error) {
      this.logger.error(
        `初始化头像目录失败: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  private async removeAvatarFile(avatarUrl: string) {
    if (!avatarUrl.startsWith(AVATAR_API_PREFIX)) {
      return;
    }
    const fileName = avatarUrl.replace(`${AVATAR_API_PREFIX}/`, '');
    const filePath = path.join(this.avatarDir, fileName);
    try {
      await fsPromises.access(filePath);
      await fsPromises.unlink(filePath);
    } catch {
      // ignore
    }
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
    const {
      page,
      limit,
      search,
      role,
      status,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = filters;

    // 构建查询条件
    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { nickname: { contains: search, mode: 'insensitive' } },
      ];
    }

    const roleValue = toUserRole(role);
    if (roleValue) {
      where.role = roleValue;
    }

    const statusValue = toUserStatus(status);
    if (statusValue) {
      where.status = statusValue;
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
            favorites: true,
          },
        },
      },
      orderBy: {
        [sortBy]: sortOrder,
      },
      skip,
      take: limit,
    });

    return {
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
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
            login_logs: true,
          },
        },
      },
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
      where: { id },
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
        updated_at: true,
      },
    });
  }

  /**
   * 更新用户角色
   */
  async updateUserRole(id: number, role: 'USER' | 'ADMIN') {
    const user = await this.databaseService.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 防止降级最后一个管理员
    if (role === 'USER' && user.role === 'ADMIN') {
      const adminCount = await this.databaseService.user.count({
        where: { role: 'ADMIN' },
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
        updated_at: true,
      },
    });
  }

  /**
   * 管理员更新用户基本信息
   */
  async updateUserByAdmin(
    id: number,
    updateData: {
      username?: string;
      email?: string;
      nickname?: string;
      phoneNumber?: string;
    },
  ) {
    const user = await this.databaseService.user.findUnique({
      where: { id },
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
                updateData.email ? { email: updateData.email } : {},
              ].filter((obj) => Object.keys(obj).length > 0),
            },
          ],
        },
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
        updated_at: true,
      },
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
      todayUsers, // 今日新增用户数
      recentUsers, // 最近7天新增用户数
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
            gte: todayStart,
          },
        },
      }),
      // 最近7天注册用户数
      this.databaseService.user.count({
        where: {
          created_at: {
            gte: weekStart,
          },
        },
      }),
    ]);

    return {
      totalUsers,
      activeUsers,
      suspendedUsers,
      adminUsers,
      regularUsers,
      todayUsers, // 新增：今日用户数
      recentUsers, // 保持：7天内用户数
      statusDistribution: {
        active: activeUsers,
        suspended: suspendedUsers,
      },
      roleDistribution: {
        admin: adminUsers,
        user: regularUsers,
      },
    };
  }
}
