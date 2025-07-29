import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
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
            log: process.env.NODE_ENV === 'development'
                ? ['query', 'info', 'warn', 'error']
                : ['warn', 'error'],
            // 错误格式化
            errorFormat: 'pretty',
        });

        // 性能监控中间件
        this.$use(async (params, next) => {
            const start = Date.now();
            const result = await next(params);
            const duration = Date.now() - start;

            // 记录慢查询（超过100ms）
            if (duration > 100) {
                this.logger.warn(`慢查询检测: ${params.model}.${params.action} 耗时 ${duration}ms`);
            }

            return result;
        });

        // 查询优化中间件
        this.$use(async (params, next) => {
            // 自动添加分页限制，防止大量数据查询
            if (params.action === 'findMany' && !params.args.take) {
                params.args.take = 100; // 默认限制100条
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
            this.logConnectionPoolStatus();
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
        options: {
            where?: any;
            include?: any;
            orderBy?: any;
            skip?: number;
            take?: number;
        }
    ) {
        const { skip = 0, take = 20, ...queryOptions } = options;

        // 限制每页最大数量
        const limitedTake = Math.min(take, 100);

        const [data, total] = await Promise.all([
            (this as any)[model].findMany({
                ...queryOptions,
                skip,
                take: limitedTake,
            }),
            (this as any)[model].count({
                where: queryOptions.where,
            }),
        ]);

        return {
            data,
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
    async batchCreate(model: string, data: any[], batchSize = 100) {
        const results: any[] = [];

        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            const batchResult = await (this as any)[model].createMany({
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
    private queryCache = new Map<string, { data: any; timestamp: number }>();
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟

    async cachedQuery<T>(
        cacheKey: string,
        queryFn: () => Promise<T>,
        ttl: number = this.CACHE_TTL
    ): Promise<T> {
        const cached = this.queryCache.get(cacheKey);
        const now = Date.now();

        if (cached && (now - cached.timestamp) < ttl) {
            return cached.data;
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
            this.logger.error('数据库健康检查失败:', error);
            return { status: 'unhealthy', error: error.message, timestamp: new Date() };
        }
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
        `
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
