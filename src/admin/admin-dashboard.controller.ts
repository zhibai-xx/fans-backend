import { Controller, Get, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';
import { AdminDashboardService } from './admin-dashboard.service';

@ApiTags('管理面板')
@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
@ApiBearerAuth()
export class AdminDashboardController {
  private readonly logger = new Logger(AdminDashboardController.name);

  constructor(private readonly dashboardService: AdminDashboardService) { }

  /**
   * 获取管理面板统计数据
   */
  @Get('stats')
  @ApiOperation({ summary: '获取管理面板统计数据' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getDashboardStats() {
    try {
      const stats = await this.dashboardService.getDashboardStats();
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      this.logger.error('获取管理面板统计数据失败:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * 获取近期活动日志
   */
  @Get('recent-activities')
  @ApiOperation({ summary: '获取近期活动日志' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getRecentActivities() {
    try {
      const activities = await this.dashboardService.getRecentActivities();
      return {
        success: true,
        data: activities,
      };
    } catch (error) {
      this.logger.error('获取近期活动失败:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * 获取系统状态信息
   */
  @Get('system-status')
  @ApiOperation({ summary: '获取系统状态信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getSystemStatus() {
    try {
      const status = await this.dashboardService.getSystemStatus();
      return {
        success: true,
        data: status,
      };
    } catch (error) {
      this.logger.error('获取系统状态失败:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }
}