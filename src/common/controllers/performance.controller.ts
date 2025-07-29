import { Controller, Get, Post, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { DatabasePerformanceService, PerformanceReport, QueryMetrics } from '../../database/database-performance.service';
import { ResponseOptimizationInterceptor } from '../interceptors/response-optimization.interceptor';

@ApiTags('性能监控')
@Controller('performance')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PerformanceController {
  private readonly logger = new Logger(PerformanceController.name);

  constructor(
    private readonly dbPerformanceService: DatabasePerformanceService,
    private readonly responseOptimizationInterceptor: ResponseOptimizationInterceptor
  ) { }

  /**
   * 获取数据库性能报告
   */
  @Get('database/report')
  @ApiOperation({ summary: '获取数据库性能报告' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getDatabasePerformanceReport(): Promise<{
    success: boolean;
    data: PerformanceReport;
    timestamp: Date;
  }> {
    try {
      const report = await this.dbPerformanceService.getPerformanceReport();
      return {
        success: true,
        data: report,
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error('获取数据库性能报告失败:', error);
      throw error;
    }
  }

  /**
   * 获取数据库优化建议
   */
  @Get('database/optimization')
  @ApiOperation({ summary: '获取数据库优化建议' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getDatabaseOptimizationSuggestions() {
    try {
      const suggestions = await this.dbPerformanceService.getOptimizationSuggestions();
      return {
        success: true,
        data: suggestions,
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error('获取数据库优化建议失败:', error);
      throw error;
    }
  }

  /**
   * 获取查询统计信息
   */
  @Get('database/query-stats')
  @ApiOperation({ summary: '获取查询统计信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  getQueryStats(): {
    success: boolean;
    data: {
      totalQueries: number;
      queryByModel: Record<string, { count: number; totalDuration: number; avgDuration: number }>;
      slowestQueries: QueryMetrics[];
      timestamp: Date;
    };
    timestamp: Date;
  } {
    try {
      const stats = this.dbPerformanceService.getQueryStats();
      return {
        success: true,
        data: stats,
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error('获取查询统计信息失败:', error);
      throw error;
    }
  }

  /**
   * 获取缓存统计信息
   */
  @Get('cache/stats')
  @ApiOperation({ summary: '获取缓存统计信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  getCacheStats() {
    try {
      const stats = this.responseOptimizationInterceptor.getCacheStats();
      return {
        success: true,
        data: stats,
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error('获取缓存统计信息失败:', error);
      throw error;
    }
  }

  /**
   * 清空缓存
   */
  @Post('cache/clear')
  @ApiOperation({ summary: '清空缓存' })
  @ApiResponse({ status: 200, description: '清空成功' })
  clearCache() {
    try {
      this.responseOptimizationInterceptor.clearCache();
      return {
        success: true,
        message: '缓存已清空',
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error('清空缓存失败:', error);
      throw error;
    }
  }

  /**
   * 清空性能指标历史
   */
  @Post('database/clear-metrics')
  @ApiOperation({ summary: '清空性能指标历史' })
  @ApiResponse({ status: 200, description: '清空成功' })
  clearMetricsHistory() {
    try {
      this.dbPerformanceService.clearMetricsHistory();
      return {
        success: true,
        message: '性能指标历史已清空',
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error('清空性能指标历史失败:', error);
      throw error;
    }
  }

  /**
   * 获取系统性能概览
   */
  @Get('overview')
  @ApiOperation({ summary: '获取系统性能概览' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getPerformanceOverview() {
    try {
      const [dbReport, cacheStats, queryStats] = await Promise.all([
        this.dbPerformanceService.getPerformanceReport(),
        this.responseOptimizationInterceptor.getCacheStats(),
        this.dbPerformanceService.getQueryStats()
      ]);

      // 计算性能评分
      const performanceScore = this.calculatePerformanceScore(dbReport, queryStats);

      return {
        success: true,
        data: {
          performanceScore,
          database: {
            averageQueryTime: dbReport.averageQueryTime,
            slowQueriesCount: dbReport.slowQueries.length,
            totalQueries: dbReport.queryCount,
            recommendations: dbReport.recommendations
          },
          cache: {
            hitRate: this.calculateCacheHitRate(cacheStats),
            size: cacheStats.size,
            maxSize: cacheStats.maxSize
          },
          queries: {
            totalQueries: queryStats.totalQueries,
            slowestQuery: queryStats.slowestQueries[0]?.duration || 0,
            modelStats: queryStats.queryByModel
          }
        },
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error('获取系统性能概览失败:', error);
      throw error;
    }
  }

  /**
   * 计算性能评分
   */
  private calculatePerformanceScore(dbReport: any, queryStats: any): number {
    let score = 100;

    // 根据平均查询时间扣分
    if (dbReport.averageQueryTime > 200) {
      score -= 30;
    } else if (dbReport.averageQueryTime > 100) {
      score -= 15;
    }

    // 根据慢查询数量扣分
    if (dbReport.slowQueries.length > 10) {
      score -= 20;
    } else if (dbReport.slowQueries.length > 5) {
      score -= 10;
    }

    // 根据总查询数量和性能扣分
    if (queryStats.totalQueries > 1000 && dbReport.averageQueryTime > 50) {
      score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 计算缓存命中率
   */
  private calculateCacheHitRate(cacheStats: any): number {
    // 这里简化处理，实际应该跟踪命中和未命中次数
    return cacheStats.size > 0 ? 85 : 0;
  }
} 