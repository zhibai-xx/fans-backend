import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

/**
 * 速率限制配置接口
 */
interface RateLimitConfig {
  windowMs: number;  // 时间窗口（毫秒）
  maxRequests: number;  // 最大请求数
  skipSuccessfulRequests?: boolean;  // 是否跳过成功请求
  skipFailedRequests?: boolean;  // 是否跳过失败请求
  keyGenerator?: (req: Request) => string;  // 键生成器
}

/**
 * 请求记录接口
 */
interface RequestRecord {
  count: number;
  resetTime: number;
  blocked: boolean;
  blockedUntil?: number;
}

/**
 * API速率限制守卫
 * 
 * 功能：
 * - 基于IP地址的速率限制
 * - 基于用户ID的速率限制
 * - 自动清理过期记录
 * - 支持不同端点的不同限制
 * - 支持临时封禁恶意IP
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  // 请求记录存储（生产环境建议使用Redis）
  private readonly requestRecords = new Map<string, RequestRecord>();

  // 默认配置
  private readonly defaultConfig: RateLimitConfig = {
    windowMs: 15 * 60 * 1000, // 15分钟
    maxRequests: 100, // 最大100次请求
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    keyGenerator: (req: Request) => this.getClientKey(req),
  };

  // 恶意IP封禁配置
  private readonly maliciousIpConfig = {
    maxViolations: 5, // 最大违规次数
    banDuration: 60 * 60 * 1000, // 封禁1小时
  };

  // 违规记录
  private readonly violationRecords = new Map<string, { count: number; lastViolation: number }>();

  constructor(private readonly reflector: Reflector) {
    // 定期清理过期记录
    setInterval(() => {
      this.cleanupExpiredRecords();
    }, 5 * 60 * 1000); // 每5分钟清理一次
  }

  /**
   * 守卫主要逻辑
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse();

    // 获取速率限制配置
    const config = this.getRateLimitConfig(context);

    // 生成客户端唯一键
    const clientKey = config.keyGenerator!(request);

    // 检查是否被封禁
    if (this.isBlocked(clientKey)) {
      this.logger.warn(`被封禁的客户端尝试访问: ${clientKey}, IP: ${this.getClientIp(request)}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: '您的IP已被临时封禁，请稍后再试',
          error: 'IP_BLOCKED',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 检查速率限制
    const allowed = this.checkRateLimit(clientKey, config);

    if (!allowed) {
      // 记录违规
      this.recordViolation(clientKey);

      // 检查是否需要封禁
      if (this.shouldBanClient(clientKey)) {
        this.banClient(clientKey);
        this.logger.warn(`客户端因多次违规被封禁: ${clientKey}, IP: ${this.getClientIp(request)}`);
      }

      const record = this.requestRecords.get(clientKey);
      const resetTime = record ? new Date(record.resetTime) : new Date();

      // 设置响应头
      response.setHeader('X-RateLimit-Limit', config.maxRequests);
      response.setHeader('X-RateLimit-Remaining', 0);
      response.setHeader('X-RateLimit-Reset', resetTime.toISOString());

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: '请求过于频繁，请稍后再试',
          error: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil((record!.resetTime - Date.now()) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 设置响应头
    const record = this.requestRecords.get(clientKey)!;
    response.setHeader('X-RateLimit-Limit', config.maxRequests);
    response.setHeader('X-RateLimit-Remaining', Math.max(0, config.maxRequests - record.count));
    response.setHeader('X-RateLimit-Reset', new Date(record.resetTime).toISOString());

    return true;
  }

  /**
   * 获取速率限制配置
   */
  private getRateLimitConfig(context: ExecutionContext): RateLimitConfig {
    // 可以通过装饰器自定义配置
    const customConfig = this.reflector.get<Partial<RateLimitConfig>>('rateLimit', context.getHandler());

    return {
      ...this.defaultConfig,
      ...customConfig,
    };
  }

  /**
   * 检查速率限制
   */
  private checkRateLimit(clientKey: string, config: RateLimitConfig): boolean {
    const now = Date.now();
    const record = this.requestRecords.get(clientKey);

    if (!record) {
      // 首次请求
      this.requestRecords.set(clientKey, {
        count: 1,
        resetTime: now + config.windowMs,
        blocked: false,
      });
      return true;
    }

    // 检查时间窗口是否过期
    if (now > record.resetTime) {
      // 重置计数器
      record.count = 1;
      record.resetTime = now + config.windowMs;
      record.blocked = false;
      return true;
    }

    // 检查是否超过限制
    if (record.count >= config.maxRequests) {
      return false;
    }

    // 增加计数
    record.count++;
    return true;
  }

  /**
   * 获取客户端唯一键
   */
  private getClientKey(req: Request): string {
    // 优先使用用户ID（如果已认证）
    const user = (req as any).user;
    if (user && user.id) {
      return `user:${user.id}`;
    }

    // 使用IP地址
    const ip = this.getClientIp(req);
    return `ip:${ip}`;
  }

  /**
   * 获取客户端IP地址
   */
  private getClientIp(req: Request): string {
    return (
      req.headers['x-forwarded-for'] as string ||
      req.headers['x-real-ip'] as string ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }

  /**
   * 检查客户端是否被封禁
   */
  private isBlocked(clientKey: string): boolean {
    const record = this.requestRecords.get(clientKey);
    if (!record || !record.blocked) {
      return false;
    }

    // 检查封禁是否过期
    if (record.blockedUntil && Date.now() > record.blockedUntil) {
      record.blocked = false;
      record.blockedUntil = undefined;
      return false;
    }

    return true;
  }

  /**
   * 记录违规
   */
  private recordViolation(clientKey: string): void {
    const now = Date.now();
    const violation = this.violationRecords.get(clientKey);

    if (!violation) {
      this.violationRecords.set(clientKey, {
        count: 1,
        lastViolation: now,
      });
    } else {
      violation.count++;
      violation.lastViolation = now;
    }
  }

  /**
   * 检查是否应该封禁客户端
   */
  private shouldBanClient(clientKey: string): boolean {
    const violation = this.violationRecords.get(clientKey);
    if (!violation) {
      return false;
    }

    // 检查违规次数
    if (violation.count >= this.maliciousIpConfig.maxViolations) {
      // 检查违规是否在短时间内
      const timeSinceLastViolation = Date.now() - violation.lastViolation;
      if (timeSinceLastViolation < 10 * 60 * 1000) { // 10分钟内
        return true;
      }
    }

    return false;
  }

  /**
   * 封禁客户端
   */
  private banClient(clientKey: string): void {
    const record = this.requestRecords.get(clientKey);
    if (record) {
      record.blocked = true;
      record.blockedUntil = Date.now() + this.maliciousIpConfig.banDuration;
    } else {
      this.requestRecords.set(clientKey, {
        count: 0,
        resetTime: Date.now(),
        blocked: true,
        blockedUntil: Date.now() + this.maliciousIpConfig.banDuration,
      });
    }

    this.logger.warn(`客户端被封禁: ${clientKey}, 封禁时长: ${this.maliciousIpConfig.banDuration / 1000}秒`);
  }

  /**
   * 清理过期记录
   */
  private cleanupExpiredRecords(): void {
    const now = Date.now();
    let cleanedCount = 0;

    // 清理请求记录
    for (const [key, record] of this.requestRecords.entries()) {
      if (now > record.resetTime && !record.blocked) {
        this.requestRecords.delete(key);
        cleanedCount++;
      } else if (record.blocked && record.blockedUntil && now > record.blockedUntil) {
        this.requestRecords.delete(key);
        cleanedCount++;
      }
    }

    // 清理违规记录
    for (const [key, violation] of this.violationRecords.entries()) {
      if (now - violation.lastViolation > 24 * 60 * 60 * 1000) { // 24小时后清理
        this.violationRecords.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`清理了 ${cleanedCount} 条过期记录`);
    }
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const now = Date.now();
    const activeRecords = Array.from(this.requestRecords.entries()).filter(
      ([_, record]) => now <= record.resetTime || record.blocked
    );

    const blockedClients = activeRecords.filter(([_, record]) => record.blocked);
    const violations = Array.from(this.violationRecords.entries());

    return {
      totalActiveRecords: activeRecords.length,
      blockedClients: blockedClients.length,
      totalViolations: violations.length,
      memoryUsage: {
        requestRecords: this.requestRecords.size,
        violationRecords: this.violationRecords.size,
      },
    };
  }

  /**
   * 手动解除封禁
   */
  unbanClient(clientKey: string): boolean {
    const record = this.requestRecords.get(clientKey);
    if (record && record.blocked) {
      record.blocked = false;
      record.blockedUntil = undefined;
      this.violationRecords.delete(clientKey);
      this.logger.log(`手动解除封禁: ${clientKey}`);
      return true;
    }
    return false;
  }
}

/**
 * 速率限制装饰器
 */
export const RateLimit = (config: Partial<RateLimitConfig>) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('rateLimit', config, descriptor.value);
  };
}; 