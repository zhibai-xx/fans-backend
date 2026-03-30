import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

type PrismaNext = (params: Prisma.MiddlewareParams) => Promise<unknown>;

type QueryCacheEntry = { data: unknown; timestamp: number };

type PaginationQueryOptions = {
  where?: Record<string, unknown>;
  include?: Record<string, unknown>;
  orderBy?: Record<string, unknown> | Array<Record<string, unknown>>;
  skip?: number;
  take?: number;
};

type ModelDelegate = {
  findMany: (args: Record<string, unknown>) => Promise<unknown[]>;
  count: (args: Record<string, unknown>) => Promise<number>;
  createMany?: (args: Record<string, unknown>) => Promise<unknown>;
};

type SerializableValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: SerializableValue }
  | SerializableValue[];

@Injectable()
export class DatabaseService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DatabaseService.name);

  constructor(private configService: ConfigService) {
    super({
      // 连接池配置
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      // 查询日志配置
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['warn', 'error'],
      // 错误格式化
      errorFormat: 'pretty',
    });

    // 性能监控中间件
    this.$use(async (params: Prisma.MiddlewareParams, next: PrismaNext) => {
      const start = Date.now();
      const result = await next(params);
      const duration = Date.now() - start;

      // 记录慢查询（超过100ms）
      if (duration > 100) {
        const modelName = params.model ?? 'unknown';
        const actionName = params.action ?? 'unknown';
        this.logger.warn(
          `慢查询检测: ${modelName}.${actionName} 耗时 ${duration}ms`,
        );
      }

      return result;
    });

    // 查询优化中间件
    this.$use(async (params: Prisma.MiddlewareParams, next: PrismaNext) => {
      // 自动添加分页限制，防止大量数据查询
      const args = this.asRecord(params.args);
      if (params.action === 'findMany' && args && args.take === undefined) {
        args.take = 100; // 默认限制100条
        params.args = args;
      }

      return next(params);
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('数据库连接成功');

      // 数据库性能监控
      this.startPerformanceMonitoring();
    } catch (error) {
      this.logger.error('数据库连接失败:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('数据库连接已关闭');
  }

  /**
   * 启动性能监控
   */
  private startPerformanceMonitoring() {
    // 每分钟记录一次连接池状态
    setInterval(() => {
      void this.logConnectionPoolStatus();
    }, 60000);
  }

  /**
   * 记录连接池状态
   */
  private async logConnectionPoolStatus() {
    try {
      const result = await this.$queryRaw`SELECT 
        COUNT(*) as total_connections,
        COUNT(CASE WHEN state = 'active' THEN 1 END) as active_connections,
        COUNT(CASE WHEN state = 'idle' THEN 1 END) as idle_connections
      FROM pg_stat_activity 
      WHERE datname = current_database()`;

      this.logger.log('连接池状态:', result);
    } catch (error) {
      this.logger.error('获取连接池状态失败:', error);
    }
  }

  /**
   * 优化的分页查询
   */
  async findManyWithPagination<T>(
    model: string,
    options: PaginationQueryOptions,
  ) {
    const { skip = 0, take = 20, ...queryOptions } = options;

    // 限制每页最大数量
    const limitedTake = Math.min(take, 100);
    const delegate = this.getModelDelegate(model);

    const [data, total] = await Promise.all([
      delegate.findMany({
        ...queryOptions,
        skip,
        take: limitedTake,
      }),
      delegate.count({
        where: queryOptions.where,
      }),
    ]);
    const list = Array.isArray(data) ? (data as T[]) : [];

    return {
      data: list,
      total,
      page: Math.floor(skip / limitedTake) + 1,
      totalPages: Math.ceil(total / limitedTake),
      hasNext: skip + limitedTake < total,
      hasPrev: skip > 0,
    };
  }

  /**
   * 批量操作优化
   */
  async batchCreate(
    model: string,
    data: ReadonlyArray<unknown>,
    batchSize = 100,
  ) {
    const results: unknown[] = [];
    const delegate = this.getModelDelegate(model);
    if (!delegate.createMany) {
      throw new Error(`模型 ${model} 不支持 createMany`);
    }

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const batchResult = await delegate.createMany({
        data: batch,
        skipDuplicates: true,
      });
      results.push(batchResult);
    }

    return results;
  }

  /**
   * 缓存查询结果
   */
  private queryCache = new Map<string, QueryCacheEntry>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟

  async cachedQuery<T>(
    cacheKey: string,
    queryFn: () => Promise<T>,
    ttl: number = this.CACHE_TTL,
  ): Promise<T> {
    const cached = this.queryCache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.timestamp < ttl) {
      return cached.data as T;
    }

    const data = await queryFn();
    this.queryCache.set(cacheKey, { data, timestamp: now });

    // 清理过期缓存
    this.cleanExpiredCache();

    return data;
  }

  /**
   * 清理过期缓存
   */
  private cleanExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.queryCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.queryCache.delete(key);
      }
    }
  }

  /**
   * 数据库健康检查
   */
  async healthCheck() {
    try {
      await this.$queryRaw`SELECT 1`;
      return { status: 'healthy', timestamp: new Date() };
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      this.logger.error(`数据库健康检查失败: ${message}`);
      return {
        status: 'unhealthy',
        error: message,
        timestamp: new Date(),
      };
    }
  }

  /**
   * 转换BigInt为字符串，解决JSON序列化问题
   */
  private convertBigIntToString(data: unknown): SerializableValue {
    if (data === null || data === undefined) {
      return null;
    }

    if (typeof data === 'bigint') {
      return data.toString();
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.convertBigIntToString(item));
    }

    if (typeof data === 'object') {
      const result: Record<string, SerializableValue> = {};
      for (const [key, value] of Object.entries(data)) {
        result[key] = this.convertBigIntToString(value);
      }
      return result;
    }

    if (typeof data === 'number' || typeof data === 'string') {
      return data;
    }
    if (typeof data === 'boolean') {
      return data;
    }
    return null;
  }

  private getModelDelegate(model: string): ModelDelegate {
    const delegate = (this as Record<string, unknown>)[model];
    if (this.isModelDelegate(delegate)) {
      return delegate;
    }
    throw new Error(`未知的模型: ${model}`);
  }

  private isModelDelegate(value: unknown): value is ModelDelegate {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const record = value as Record<string, unknown>;
    return (
      typeof record.findMany === 'function' &&
      typeof record.count === 'function'
    );
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  /**
   * 获取数据库统计信息
   */
  async getStats() {
    try {
      const [tableStats, indexStats] = await Promise.all([
        this.$queryRaw`
          SELECT 
            schemaname,
            relname as tablename,
            n_tup_ins as inserts,
            n_tup_upd as updates,
            n_tup_del as deletes,
            n_live_tup as live_tuples,
            n_dead_tup as dead_tuples
          FROM pg_stat_user_tables
          ORDER BY n_live_tup DESC
        `,
        this.$queryRaw`
          SELECT 
            schemaname,
            relname as tablename,
            indexrelname as indexname,
            idx_scan as scans,
            idx_tup_read as tuples_read,
            idx_tup_fetch as tuples_fetched
          FROM pg_stat_user_indexes
          WHERE idx_scan > 0
          ORDER BY idx_scan DESC
        `,
      ]);

      return {
        tables: this.convertBigIntToString(tableStats),
        indexes: this.convertBigIntToString(indexStats),
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('获取数据库统计信息失败:', error);
      // 返回空数据而不是抛出错误，避免影响其他功能
      return {
        tables: [],
        indexes: [],
        timestamp: new Date(),
      };
    }
  }
}
