import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Response } from 'express';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);

interface CacheEntry {
  data: any;
  timestamp: number;
  etag: string;
}

@Injectable()
export class ResponseOptimizationInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ResponseOptimizationInterceptor.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存
  private readonly MAX_CACHE_SIZE = 1000; // 最大缓存条目数

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, headers } = request;

    // 定义不应该被缓存的URL模式
    const noCachePatterns = [
      '/api/media/review/stats',    // 审核统计
      '/api/media/review/list',     // 审核列表
      '/api/media/review/',         // 所有审核相关API
      '/api/performance/',          // 性能监控API
      '/api/upload/',              // 上传相关API
    ];

    const shouldSkipCache = noCachePatterns.some(pattern => url.includes(pattern));

    // 只对GET请求进行缓存，但排除实时数据API
    if (method === 'GET' && !shouldSkipCache) {
      const cacheKey = this.generateCacheKey(url, headers);
      const cached = this.getFromCache(cacheKey);

      if (cached) {
        // 检查客户端缓存
        if (headers['if-none-match'] === cached.etag) {
          response.status(304).end();
          return new Observable(subscriber => subscriber.complete());
        }

        // 返回缓存数据
        this.setResponseHeaders(response, cached.etag, true);
        response.json(cached.data);
        return new Observable(subscriber => subscriber.complete());
      }
    }

    const startTime = Date.now();

    return next.handle().pipe(
      map(data => {
        const duration = Date.now() - startTime;

        // 记录慢响应
        if (duration > 1000) {
          this.logger.warn(`慢响应检测: ${method} ${url} 耗时 ${duration}ms`);
        }

        // 转换BigInt为字符串，解决JSON序列化问题
        return this.convertBigIntToString(data);
      }),
      tap(async data => {
        // 对GET请求的响应进行缓存，但排除实时数据API
        if (method === 'GET' && !shouldSkipCache && data) {
          const cacheKey = this.generateCacheKey(url, headers);
          const etag = this.generateETag(data);

          this.setToCache(cacheKey, data, etag);
          this.setResponseHeaders(response, etag, false);
        }

        // 响应压缩
        await this.compressResponse(response, data);
      })
    );
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(url: string, headers: any): string {
    const userAgent = headers['user-agent'] || '';
    const acceptLanguage = headers['accept-language'] || '';
    return `${url}:${userAgent}:${acceptLanguage}`;
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
   * 生成ETag
   */
  private generateETag(data: any): string {
    const convertedData = this.convertBigIntToString(data);
    const content = JSON.stringify(convertedData);
    return `"${Buffer.from(content).toString('base64').slice(0, 16)}"`;
  }

  /**
   * 从缓存获取数据
   */
  private getFromCache(key: string): CacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  /**
   * 设置缓存数据
   */
  private setToCache(key: string, data: any, etag: string): void {
    // 清理过期缓存
    this.cleanExpiredCache();

    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      etag,
    });
  }

  /**
   * 清理过期缓存
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 设置响应头
   */
  private setResponseHeaders(response: Response, etag: string, fromCache: boolean): void {
    // 检查响应是否已经发送
    if (response.headersSent) {
      return;
    }

    response.setHeader('ETag', etag);
    response.setHeader('Cache-Control', 'private, max-age=300'); // 5分钟客户端缓存

    if (fromCache) {
      response.setHeader('X-Cache', 'HIT');
    } else {
      response.setHeader('X-Cache', 'MISS');
    }
  }

  /**
   * 压缩响应
   */
  private async compressResponse(response: Response, data: any): Promise<void> {
    // 检查响应是否已经发送
    if (response.headersSent) {
      return;
    }

    if (!data || typeof data !== 'object') return;

    const acceptEncoding = response.req.headers['accept-encoding'] || '';
    const content = JSON.stringify(data);

    // 只压缩大于1KB的响应
    if (content.length < 1024) return;

    try {
      if (acceptEncoding.includes('gzip')) {
        const compressed = await gzip(content);

        // 再次检查响应是否已经发送
        if (!response.headersSent) {
          response.setHeader('Content-Encoding', 'gzip');
          response.setHeader('Content-Length', compressed.length);
          response.setHeader('X-Compression', 'gzip');
        }
      }
    } catch (error) {
      this.logger.error('响应压缩失败:', error);
    }
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      ttl: this.CACHE_TTL,
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        timestamp: entry.timestamp,
        age: Date.now() - entry.timestamp,
      })),
    };
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.log('响应缓存已清空');
  }
} 