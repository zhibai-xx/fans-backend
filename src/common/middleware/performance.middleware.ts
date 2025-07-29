import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PerformanceMiddleware implements NestMiddleware {
  private readonly logger = new Logger(PerformanceMiddleware.name);

  constructor(private configService: ConfigService) { }

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();

    // 只做基本的性能监控，不重写任何方法
    this.addBasicPerformanceMonitoring(req, res, startTime);

    // 设置基本缓存头部（安全地）
    this.setBasicCacheHeaders(req, res);

    next();
  }

  private addBasicPerformanceMonitoring(req: Request, res: Response, startTime: number) {
    // 只使用事件监听，不重写方法
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const { method, originalUrl } = req;
      const { statusCode } = res;

      // 记录性能指标
      this.logger.log(`${method} ${originalUrl} ${statusCode} - ${duration}ms`);

      // 警告慢请求
      if (duration > 1000) {
        this.logger.warn(`Slow request: ${method} ${originalUrl} took ${duration}ms`);
      }
    });
  }

  private setBasicCacheHeaders(req: Request, res: Response) {
    // 只在响应还没有发送时设置头部
    if (res.headersSent) return;

    try {
      // 为不同类型的API设置基本缓存控制
      if (req.path.includes('/api/upload/file/')) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
      } else if (req.path.includes('/api/media/review/')) {
        // 审核相关API不缓存，确保实时性
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      } else if (req.path.includes('/api/media/')) {
        res.setHeader('Cache-Control', 'public, max-age=300');
      } else if (req.method === 'GET' && req.path.includes('/api/')) {
        res.setHeader('Cache-Control', 'public, max-age=60');
      }
    } catch (error) {
      // 静默处理缓存头部设置错误，不影响正常响应
      this.logger.warn('Failed to set cache headers:', error.message);
    }
  }
}

/**
 * 响应时间监控中间件 - 简化版
 */
@Injectable()
export class ResponseTimeMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ResponseTimeMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = process.hrtime.bigint();

    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;

      // 只在需要时记录到日志，不设置头部
      if (duration > 1000) {
        this.logger.warn(`Slow response: ${req.method} ${req.originalUrl} - ${duration.toFixed(2)}ms`);
      }
    });

    next();
  }
}

/**
 * 内存监控中间件
 */
@Injectable()
export class MemoryMonitorMiddleware implements NestMiddleware {
  private readonly logger = new Logger(MemoryMonitorMiddleware.name);
  private lastMemoryCheck = 0;
  private readonly checkInterval = 30000; // 30秒

  use(req: Request, res: Response, next: NextFunction) {
    const now = Date.now();

    if (now - this.lastMemoryCheck > this.checkInterval) {
      this.lastMemoryCheck = now;

      const memoryUsage = process.memoryUsage();
      const memoryMB = {
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
      };

      this.logger.log(`Memory usage: RSS=${memoryMB.rss}MB, Heap=${memoryMB.heapUsed}/${memoryMB.heapTotal}MB, External=${memoryMB.external}MB`);

      // 内存使用过高警告
      if (memoryMB.heapUsed > 500) {
        this.logger.warn(`High memory usage: ${memoryMB.heapUsed}MB heap used`);
      }
    }

    next();
  }
}

/**
 * 请求日志中间件
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLoggerMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip, headers } = req;
    const userAgent = headers['user-agent'] || '';
    const startTime = Date.now();

    // 记录请求开始
    this.logger.log(`${method} ${originalUrl} - ${ip} - ${userAgent}`);

    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - startTime;

      // 记录请求完成
      this.logger.log(`${method} ${originalUrl} ${statusCode} - ${duration}ms`);
    });

    next();
  }
} 