import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import {
  UserResponseDto,
  PublicUserResponseDto,
} from '../dto/user-response.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LoginLogService } from '../../logs/services/login-log.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Express, Request as ExpressRequest } from 'express';
import { AVATAR_MAX_SIZE } from '../services/user.service';

const avatarUploadOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: AVATAR_MAX_SIZE,
  },
};

type AuthenticatedRequest = ExpressRequest & {
  user: {
    id: number;
    username: string;
    role: string;
    uuid?: string;
  };
};

type LoginLogServiceLike = Pick<
  LoginLogService,
  | 'logLoginAttempt'
  | 'extractIpAddress'
  | 'extractUserAgent'
  | 'checkLoginAllowed'
>;

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return '未知错误';
};

const buildLoginAttemptContext = (
  loginLogService: LoginLogServiceLike,
  req: ExpressRequest,
): { ipAddress: string; userAgent: string } => ({
  ipAddress: loginLogService.extractIpAddress(req),
  userAgent: loginLogService.extractUserAgent(req),
});

const recordPasswordAttempt = async (
  loginLogService: LoginLogServiceLike,
  params: {
    req: ExpressRequest;
    result: 'FAILED' | 'BLOCKED';
    username: string;
    failReason: string;
  },
): Promise<void> => {
  const { ipAddress, userAgent } = buildLoginAttemptContext(
    loginLogService,
    params.req,
  );

  await loginLogService.logLoginAttempt({
    login_type: 'PASSWORD',
    ip_address: ipAddress,
    user_agent: userAgent,
    result: params.result,
    fail_reason: params.failReason,
    username: params.username,
  });
};

@ApiTags('用户')
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly loginLogService: LoginLogService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: '用户注册' })
  @ApiResponse({ status: 201, description: '注册成功' })
  @ApiResponse({ status: 409, description: '用户名或邮箱已被注册' })
  async register(@Body() registerDto: RegisterDto, @Req() req: ExpressRequest) {
    const loginLogService: LoginLogServiceLike = this.loginLogService;

    try {
      const user = await this.userService.register(registerDto);
      const result = await this.authService.login(user);
      const { ipAddress, userAgent } = buildLoginAttemptContext(
        loginLogService,
        req,
      );

      // 记录成功注册的登录日志
      await loginLogService.logLoginAttempt({
        user_id: user.id,
        login_type: 'PASSWORD',
        ip_address: ipAddress,
        user_agent: userAgent,
        result: 'SUCCESS',
      });

      return result;
    } catch (error: unknown) {
      await recordPasswordAttempt(loginLogService, {
        req,
        result: 'FAILED',
        failReason: getErrorMessage(error),
        username: registerDto.username,
      });
      throw error;
    }
  }

  @Post('login')
  @ApiOperation({ summary: '用户登录' })
  @ApiResponse({ status: 200, description: '登录成功' })
  @ApiResponse({ status: 401, description: '用户名或密码错误' })
  async login(@Body() loginDto: LoginDto, @Req() req: ExpressRequest) {
    const loginLogService: LoginLogServiceLike = this.loginLogService;
    const { ipAddress, userAgent } = buildLoginAttemptContext(
      loginLogService,
      req,
    );
    const guardResult = await loginLogService.checkLoginAllowed({
      ipAddress,
      username: loginDto.username,
    });

    if (!guardResult.allowed) {
      await recordPasswordAttempt(loginLogService, {
        req,
        result: 'BLOCKED',
        failReason: guardResult.reason || '登录限制命中',
        username: loginDto.username,
      });

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: '登录尝试过于频繁，请稍后再试',
          error: 'Too Many Requests',
          retryAfterSeconds: guardResult.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    try {
      const user = await this.userService.login(loginDto);
      const result = await this.authService.login(user);

      // 记录成功登录
      await this.loginLogService.logLoginAttempt({
        user_id: user.id,
        login_type: 'PASSWORD',
        ip_address: ipAddress,
        user_agent: userAgent,
        result: 'SUCCESS',
      });

      return result;
    } catch (error: unknown) {
      await recordPasswordAttempt(loginLogService, {
        req,
        result: 'FAILED',
        failReason: getErrorMessage(error),
        username: loginDto.username,
      });
      throw error;
    }
  }

  @Post('refresh-token')
  @ApiOperation({ summary: '刷新访问令牌' })
  @ApiResponse({ status: 200, description: '刷新成功' })
  @ApiResponse({ status: 401, description: 'refresh token 无效或已过期' })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshAccessToken(refreshTokenDto.refresh_token);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '用户登出（使当前会话失效）' })
  @ApiResponse({ status: 200, description: '登出成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  async logout(@Req() req: AuthenticatedRequest) {
    return this.authService.logout(req.user.id);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户信息' })
  @ApiResponse({ status: 200, description: '获取成功', type: UserResponseDto })
  @ApiResponse({ status: 401, description: '未授权' })
  async getProfile(@Req() req: AuthenticatedRequest) {
    const user = await this.userService.findById(req.user.id);
    return new UserResponseDto(user);
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新当前用户信息' })
  @ApiResponse({ status: 200, description: '更新成功', type: UserResponseDto })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 409, description: '用户名或邮箱已被使用' })
  async updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const user = await this.userService.updateUser(req.user.id, updateUserDto);
    return new UserResponseDto(user);
  }

  @Post('profile/avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('avatar', avatarUploadOptions))
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        avatar: {
          type: 'string',
          format: 'binary',
          description: '头像图片文件（JPG/PNG/WebP，<=2MB）',
        },
      },
      required: ['avatar'],
    },
  })
  @ApiOperation({ summary: '上传并更新用户头像' })
  @ApiResponse({
    status: 200,
    description: '头像更新成功',
    type: UserResponseDto,
  })
  async uploadAvatar(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const user = await this.userService.updateAvatar(req.user.id, file);
    return new UserResponseDto(user);
  }

  @Get(':uuid')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取指定用户信息（公开信息）' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: PublicUserResponseDto,
  })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 404, description: '用户不存在' })
  async getUserByUuid(@Param('uuid') uuid: string) {
    const user = await this.userService.findByUuid(uuid);
    return new PublicUserResponseDto(user);
  }

  @Put('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '修改密码' })
  @ApiResponse({ status: 200, description: '密码修改成功' })
  @ApiResponse({ status: 401, description: '当前密码错误或未授权' })
  @ApiResponse({ status: 409, description: '新密码不能与当前密码相同' })
  async changePassword(
    @Req() req: AuthenticatedRequest,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    await this.userService.changePassword(req.user.id, changePasswordDto);
    return { message: '密码修改成功' };
  }
}
