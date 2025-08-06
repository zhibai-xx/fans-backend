import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe
} from '@nestjs/common';
import { UserService } from '../services/user.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('管理员-用户管理')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
@ApiBearerAuth()
export class AdminUserController {
  constructor(private readonly userService: UserService) { }

  /**
   * 获取用户列表（分页 + 筛选）
   */
  @Get()
  @ApiOperation({ summary: '获取用户列表' })
  async getUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    try {
      const result = await this.userService.getAllUsersForAdmin({
        page,
        limit,
        search,
        role: role === 'ALL' ? undefined : role,
        status: status === 'ALL' ? undefined : status,
        sortBy: sortBy || 'created_at',
        sortOrder: sortOrder || 'desc'
      });

      return {
        success: true,
        data: result.data,
        pagination: result.pagination
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * 获取用户详情
   */
  @Get(':id')
  @ApiOperation({ summary: '获取用户详情' })
  async getUserById(@Param('id', ParseIntPipe) id: number) {
    try {
      const user = await this.userService.findByIdWithStats(id);

      return {
        success: true,
        data: user
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * 更新用户状态（激活/暂停）
   */
  @Put(':id/status')
  @ApiOperation({ summary: '更新用户状态' })
  async updateUserStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: 'ACTIVE' | 'SUSPENDED' }
  ) {
    try {
      const user = await this.userService.updateUserStatus(id, body.status);

      return {
        success: true,
        data: user,
        message: `用户状态已更新为${body.status === 'ACTIVE' ? '激活' : '暂停'}`
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * 更新用户角色（提升/降级）
   */
  @Put(':id/role')
  @ApiOperation({ summary: '更新用户角色' })
  async updateUserRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { role: 'USER' | 'ADMIN' }
  ) {
    try {
      const user = await this.userService.updateUserRole(id, body.role);

      return {
        success: true,
        data: user,
        message: `用户角色已更新为${body.role === 'ADMIN' ? '管理员' : '普通用户'}`
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * 更新用户基本信息
   */
  @Put(':id')
  @ApiOperation({ summary: '更新用户基本信息' })
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateData: {
      username?: string;
      email?: string;
      nickname?: string;
      phoneNumber?: string;
    }
  ) {
    try {
      const user = await this.userService.updateUserByAdmin(id, updateData);

      return {
        success: true,
        data: user,
        message: '用户信息更新成功'
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * 获取用户统计数据
   */
  @Get('stats/overview')
  @ApiOperation({ summary: '获取用户统计概览' })
  async getUserStats() {
    try {
      const stats = await this.userService.getUserStatsOverview();

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}