import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Request,
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
import { Express } from 'express';
import { AVATAR_MAX_SIZE } from '../services/user.service';

const avatarUploadOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: AVATAR_MAX_SIZE,
  },
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
  async register(@Body() registerDto: RegisterDto, @Req() req: any) {
    try {
      const user = await this.userService.register(registerDto);
      const result = await this.authService.login(user);

      // 记录成功注册的登录日志
      await this.loginLogService.logLoginAttempt({
        user_id: user.id,
        login_type: 'PASSWORD',
        ip_address: this.loginLogService.extractIpAddress(req),
        user_agent: this.loginLogService.extractUserAgent(req),
        result: 'SUCCESS',
      });

      return result;
    } catch (error) {
      // 记录失败的注册尝试
      await this.loginLogService.logLoginAttempt({
        login_type: 'PASSWORD',
        ip_address: this.loginLogService.extractIpAddress(req),
        user_agent: this.loginLogService.extractUserAgent(req),
        result: 'FAILED',
        fail_reason: error.message,
        username: registerDto.username,
      });
      throw error;
    }
  }

  @Post('login')
  @ApiOperation({ summary: '用户登录' })
  @ApiResponse({ status: 200, description: '登录成功' })
  @ApiResponse({ status: 401, description: '用户名或密码错误' })
  async login(@Body() loginDto: LoginDto, @Req() req: any) {
    try {
      const user = await this.userService.login(loginDto);
      const result = await this.authService.login(user);

      // 记录成功登录
      await this.loginLogService.logLoginAttempt({
        user_id: user.id,
        login_type: 'PASSWORD',
        ip_address: this.loginLogService.extractIpAddress(req),
        user_agent: this.loginLogService.extractUserAgent(req),
        result: 'SUCCESS',
      });

      return result;
    } catch (error) {
      // 记录失败的登录尝试
      await this.loginLogService.logLoginAttempt({
        login_type: 'PASSWORD',
        ip_address: this.loginLogService.extractIpAddress(req),
        user_agent: this.loginLogService.extractUserAgent(req),
        result: 'FAILED',
        fail_reason: error.message,
        username: loginDto.username,
      });
      throw error;
    }
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户信息' })
  @ApiResponse({ status: 200, description: '获取成功', type: UserResponseDto })
  @ApiResponse({ status: 401, description: '未授权' })
  async getProfile(@Request() req) {
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
  async updateProfile(@Request() req, @Body() updateUserDto: UpdateUserDto) {
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
  @ApiResponse({ status: 200, description: '头像更新成功', type: UserResponseDto })
  async uploadAvatar(
    @Request() req,
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
    @Request() req,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    await this.userService.changePassword(req.user.id, changePasswordDto);
    return { message: '密码修改成功' };
  }
}
