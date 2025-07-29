import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from './database.service';

/**
 * 查询性能指标接口
 * 
 * 记录单次数据库查询的性能数据
 */
export interface QueryMetrics {
  query: string;      // 查询语句
  duration: number;   // 执行时间（毫秒）
  timestamp: Date;    // 查询时间戳
  model?: string;     // 数据模型名称
  action?: string;    // 操作类型（create, read, update, delete）
}

/**
 * 性能报告接口
 * 
 * 包含完整的数据库性能分析报告
 */
export interface PerformanceReport {
  slowQueries: QueryMetrics[];      // 慢查询列表
  averageQueryTime: number;         // 平均查询时间
  queryCount: number;               // 查询总数
  connectionPoolStats: any;         // 连接池状态
  indexUsage: any[];                // 索引使用情况
  tableStats: any[];                // 表统计信息
  recommendations: string[];        // 优化建议
}

/**
 * 数据库性能监控服务
 * 
 * 主要功能：
 * 1. 记录和分析数据库查询性能指标
 * 2. 监控慢查询并生成优化建议
 * 3. 提供连接池状态监控
 * 4. 分析索引使用情况和表统计信息
 * 5. 生成性能报告和优化建议
 */
@Injectable()
export class DatabasePerformanceService {
  private readonly logger = new Logger(DatabasePerformanceService.name);

  // 查询性能指标历史记录
  private queryMetrics: QueryMetrics[] = [];

  // 最大保留的性能指标记录数，防止内存溢出
  private readonly maxMetricsHistory = 1000;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService
  ) { }

  /**
   * 记录查询性能指标
   * 
   * 用于记录每次数据库查询的性能数据，包括：
   * - 查询语句
   * - 执行时间
   * - 时间戳
   * - 模型和操作类型
   * 
   * @param metric 查询性能指标对象
   */
  recordQueryMetric(metric: QueryMetrics) {
    this.queryMetrics.push(metric);

    // 保持历史记录在限制范围内，避免内存无限增长
    if (this.queryMetrics.length > this.maxMetricsHistory) {
      this.queryMetrics = this.queryMetrics.slice(-this.maxMetricsHistory);
    }
  }

  /**
   * 获取性能报告
   * 
   * 分析最近一小时的查询性能数据，生成包含以下内容的报告：
   * - 慢查询列表（执行时间超过200ms的查询）
   * - 平均查询时间
   * - 查询总数
   * - 连接池状态
   * - 索引使用情况
   * - 表统计信息
   * - 性能优化建议
   * 
   * @returns 完整的性能报告
   */
  async getPerformanceReport(): Promise<PerformanceReport> {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    // 过滤最近一小时的查询数据，只分析近期性能
    const recentQueries = this.queryMetrics.filter(
      metric => metric.timestamp.getTime() > oneHourAgo
    );

    // 慢查询分析（执行时间超过200ms的查询需要优化）
    const slowQueries = recentQueries.filter(metric => metric.duration > 200);

    // 计算平均查询时间，用于评估整体性能
    const averageQueryTime = recentQueries.length > 0
      ? recentQueries.reduce((sum, metric) => sum + metric.duration, 0) / recentQueries.length
      : 0;

    // 并行获取数据库统计信息，提高性能报告生成效率
    const [connectionPoolStats, dbStats] = await Promise.all([
      this.getConnectionPoolStats(),
      this.databaseService.getStats()
    ]);

    // 基于性能数据生成针对性的优化建议
    const recommendations = this.generateRecommendations(
      slowQueries,
      averageQueryTime,
      dbStats
    );

    return {
      slowQueries: slowQueries.slice(0, 10), // 只返回前10个慢查询
      averageQueryTime,
      queryCount: recentQueries.length,
      connectionPoolStats,
      indexUsage: (dbStats?.indexes || []) as any[],
      tableStats: (dbStats?.tables || []) as any[],
      recommendations
    };
  }

  /**
   * 获取连接池状态
   */
  private async getConnectionPoolStats() {
    try {
      const result = await this.databaseService.$queryRaw`
        SELECT 
          COUNT(*) as total_connections,
          COUNT(CASE WHEN state = 'active' THEN 1 END) as active_connections,
          COUNT(CASE WHEN state = 'idle' THEN 1 END) as idle_connections,
          COUNT(CASE WHEN state = 'idle in transaction' THEN 1 END) as idle_in_transaction
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `;

      return (result as any[])[0];
    } catch (error) {
      this.logger.error('获取连接池状态失败:', error);
      return null;
    }
  }

  /**
   * 生成性能建议
   */
  private generateRecommendations(
    slowQueries: QueryMetrics[],
    averageQueryTime: number,
    dbStats: any
  ): string[] {
    const recommendations: string[] = [];

    // 慢查询建议
    if (slowQueries.length > 0) {
      recommendations.push(
        `发现 ${slowQueries.length} 个慢查询，建议优化查询条件或添加索引`
      );
    }

    // 平均查询时间建议
    if (averageQueryTime > 100) {
      recommendations.push(
        `平均查询时间 ${averageQueryTime.toFixed(2)}ms 较高，建议优化数据库查询`
      );
    }

    // 索引使用建议
    const lowUsageIndexes = dbStats.indexes.filter(
      (index: any) => index.scans < 100
    );
    if (lowUsageIndexes.length > 0) {
      recommendations.push(
        `发现 ${lowUsageIndexes.length} 个低使用率索引，考虑删除以提高写入性能`
      );
    }

    // 表统计建议
    const tablesWithDeadTuples = dbStats.tables.filter(
      (table: any) => table.dead_tuples > 1000
    );
    if (tablesWithDeadTuples.length > 0) {
      recommendations.push(
        `发现 ${tablesWithDeadTuples.length} 个表有大量死元组，建议执行 VACUUM`
      );
    }

    return recommendations;
  }

  /**
   * 转换BigInt为字符串，解决JSON序列化问题
   */
  private convertBigIntToString(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'bigint') {
      return data.toString();
    }

    if (Array.isArray(data)) {
      return data.map(item => this.convertBigIntToString(item));
    }

    if (typeof data === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(data)) {
        result[key] = this.convertBigIntToString(value);
      }
      return result;
    }

    return data;
  }

  /**
   * 自动优化建议
   */
  async getOptimizationSuggestions() {
    try {
      // 获取未使用的索引
      const unusedIndexes = await this.databaseService.$queryRaw`
        SELECT 
          schemaname,
          relname as tablename,
          indexrelname as indexname,
          idx_scan
        FROM pg_stat_user_indexes
        WHERE idx_scan = 0
        ORDER BY schemaname, relname, indexrelname
      `;

      // 获取重复索引
      const duplicateIndexes = await this.databaseService.$queryRaw`
        SELECT 
          t.schemaname,
          t.tablename,
          array_agg(t.indexname) as duplicate_indexes
        FROM pg_indexes t
        JOIN pg_stat_user_indexes s ON t.indexname = s.indexrelname
        GROUP BY t.schemaname, t.tablename, t.indexdef
        HAVING COUNT(*) > 1
      `;

      // 获取表膨胀信息
      const tablesBloat = await this.databaseService.$queryRaw`
        SELECT 
          schemaname,
          relname as tablename,
          n_dead_tup as dead_tuples,
          n_live_tup as live_tuples,
          CASE 
            WHEN n_live_tup > 0 
            THEN (n_dead_tup::float / n_live_tup::float) * 100 
            ELSE 0 
          END as bloat_ratio
        FROM pg_stat_user_tables
        WHERE n_dead_tup > 0
        ORDER BY bloat_ratio DESC
      `;

      return {
        unusedIndexes: this.convertBigIntToString(unusedIndexes),
        duplicateIndexes: this.convertBigIntToString(duplicateIndexes),
        tablesBloat: this.convertBigIntToString((tablesBloat as any[]).filter((table: any) => table.bloat_ratio > 10)),
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error('获取优化建议失败:', error);
      throw error;
    }
  }

  /**
   * 清理性能指标历史
   */
  clearMetricsHistory() {
    this.queryMetrics = [];
    this.logger.log('性能指标历史已清理');
  }

  /**
   * 获取查询统计信息
   */
  getQueryStats() {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    const recentQueries = this.queryMetrics.filter(
      metric => metric.timestamp.getTime() > oneHourAgo
    );

    const queryByModel = recentQueries.reduce((acc, metric) => {
      const key = `${metric.model || 'unknown'}.${metric.action || 'unknown'}`;
      if (!acc[key]) {
        acc[key] = { count: 0, totalDuration: 0, avgDuration: 0 };
      }
      acc[key].count++;
      acc[key].totalDuration += metric.duration;
      acc[key].avgDuration = acc[key].totalDuration / acc[key].count;
      return acc;
    }, {} as Record<string, { count: number; totalDuration: number; avgDuration: number }>);

    return {
      totalQueries: recentQueries.length,
      queryByModel,
      slowestQueries: recentQueries
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5),
      timestamp: new Date()
    };
  }
} 