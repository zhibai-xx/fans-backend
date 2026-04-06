import { Injectable } from '@nestjs/common';
import { LogsService } from './logs.service';
import { Request } from 'express';
import { DatabaseService } from 'src/database/database.service';

type LoginGuardResult = {
  allowed: boolean;
  reason?: string;
  retryAfterSeconds?: number;
};

const toPositiveInt = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
};

/**
 * 登录日志记录服务
 * 在认证相关的控制器中手动调用
 */
@Injectable()
export class LoginLogService {
  constructor(
    private readonly logsService: LogsService,
    private readonly databaseService: DatabaseService,
  ) {}

  private readonly rateLimitWindowSeconds = toPositiveInt(
    process.env.LOGIN_RATE_LIMIT_WINDOW_SECONDS,
    15 * 60,
  );
  private readonly rateLimitMaxIpAttempts = toPositiveInt(
    process.env.LOGIN_RATE_LIMIT_MAX_IP_ATTEMPTS,
    30,
  );
  private readonly lockWindowSeconds = toPositiveInt(
    process.env.LOGIN_LOCK_WINDOW_SECONDS,
    10 * 60,
  );
  private readonly lockMaxIpFailures = toPositiveInt(
    process.env.LOGIN_LOCK_MAX_FAILURES_IP,
    8,
  );
  private readonly lockMaxUsernameFailures = toPositiveInt(
    process.env.LOGIN_LOCK_MAX_FAILURES_USERNAME,
    5,
  );
  private readonly lockDurationSeconds = toPositiveInt(
    process.env.LOGIN_LOCK_DURATION_SECONDS,
    15 * 60,
  );

  /**
   * 记录登录尝试
   */
  async logLoginAttempt(data: {
    user_id?: number;
    login_type?: 'PASSWORD' | 'OAUTH' | 'REMEMBER_ME';
    ip_address: string;
    user_agent: string;
    result: 'SUCCESS' | 'FAILED' | 'BLOCKED';
    fail_reason?: string;
    username?: string; // 用于失败的登录尝试
  }): Promise<void> {
    try {
      await this.logsService.logLogin({
        user_id: data.user_id,
        login_type: data.login_type || 'PASSWORD',
        ip_address: data.ip_address,
        user_agent: data.user_agent,
        result: data.result,
        fail_reason: data.fail_reason,
      });
    } catch (error) {
      console.error('Failed to log login attempt:', error);
    }
  }

  async checkLoginAllowed(params: {
    ipAddress: string;
    username: string;
  }): Promise<LoginGuardResult> {
    const now = Date.now();
    const rateLimitSince = new Date(now - this.rateLimitWindowSeconds * 1000);
    const lockWindowSince = new Date(now - this.lockWindowSeconds * 1000);

    const [ipAttemptsInWindow, ipFailuresInLockWindow, userRecord] =
      await Promise.all([
        this.databaseService.loginLog.count({
          where: {
            ip_address: params.ipAddress,
            created_at: { gte: rateLimitSince },
          },
        }),
        this.databaseService.loginLog.count({
          where: {
            ip_address: params.ipAddress,
            result: 'FAILED',
            created_at: { gte: lockWindowSince },
          },
        }),
        this.databaseService.user.findUnique({
          where: { username: params.username },
          select: { id: true },
        }),
      ]);

    if (ipAttemptsInWindow >= this.rateLimitMaxIpAttempts) {
      return {
        allowed: false,
        reason: 'IP 请求频率过高',
        retryAfterSeconds: this.rateLimitWindowSeconds,
      };
    }

    if (ipFailuresInLockWindow >= this.lockMaxIpFailures) {
      return {
        allowed: false,
        reason: 'IP 登录失败次数过多',
        retryAfterSeconds: this.lockDurationSeconds,
      };
    }

    if (!userRecord) {
      return { allowed: true };
    }

    const userFailuresInLockWindow = await this.databaseService.loginLog.count({
      where: {
        user_id: userRecord.id,
        result: 'FAILED',
        created_at: { gte: lockWindowSince },
      },
    });

    if (userFailuresInLockWindow >= this.lockMaxUsernameFailures) {
      return {
        allowed: false,
        reason: '账户登录失败次数过多',
        retryAfterSeconds: this.lockDurationSeconds,
      };
    }

    return { allowed: true };
  }

  /**
   * 从请求中提取IP地址
   */
  extractIpAddress(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded
      ? Array.isArray(forwarded)
        ? forwarded[0]
        : forwarded.split(',')[0]
      : req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';

    return ip.replace(/^::ffff:/, ''); // 移除IPv6前缀
  }

  /**
   * 从请求中提取User-Agent
   */
  extractUserAgent(req: Request): string {
    return req.headers['user-agent'] || 'unknown';
  }
}

/**
 * 登录结果枚举
 */
export enum LoginResult {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  BLOCKED = 'BLOCKED',
}

/**
 * 登录类型枚举
 */
export enum LoginType {
  PASSWORD = 'PASSWORD',
  OAUTH = 'OAUTH',
  REMEMBER_ME = 'REMEMBER_ME',
}
