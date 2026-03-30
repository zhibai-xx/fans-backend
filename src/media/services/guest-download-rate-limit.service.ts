import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisClientType, createClient } from 'redis';

type GuestDownloadLimitConfig = {
  windowMs: number;
  maxRequests: number;
  minIntervalMs: number;
};

type GuestDownloadLimitResult = {
  allowed: boolean;
  reason?: string;
  retryAfterSeconds?: number;
  statusCode?: number;
};

@Injectable()
export class GuestDownloadRateLimitService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(GuestDownloadRateLimitService.name);
  private client: RedisClientType | null = null;
  private readonly operationTimeoutMs = 1500;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const rawPort = this.configService.get<string>('REDIS_PORT');
    const port = rawPort ? Number.parseInt(rawPort, 10) : 6379;
    const password =
      this.configService.get<string>('REDIS_PASSWORD') || undefined;
    const rawDb = this.configService.get<string>('REDIS_DB');
    const db = rawDb ? Number.parseInt(rawDb, 10) : 0;

    this.client = createClient({
      socket: { host, port },
      password,
      database: db,
    });

    this.client.on('error', (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Redis 连接异常: ${message}`);
    });

    await this.client.connect();
    this.logger.log(`Redis 已连接: ${host}:${port}/${db}`);
  }

  async onModuleDestroy() {
    if (!this.client) {
      return;
    }
    await this.client.quit();
    this.logger.log('Redis 连接已关闭');
  }

  async checkLimit(
    guestKey: string,
    config: GuestDownloadLimitConfig,
  ): Promise<GuestDownloadLimitResult> {
    const redisClient = this.client;
    if (!redisClient || !redisClient.isReady) {
      return {
        allowed: false,
        reason: '限流服务不可用，请稍后重试',
        statusCode: 503,
      };
    }

    try {
      const now = Date.now();
      const countKey = this.buildCountKey(guestKey, now, config.windowMs);
      const lastRequestKey = `download:guest:last:${guestKey}`;

      const lastRequestAtRaw = await this.withTimeout(
        redisClient.get(lastRequestKey),
      );
      const lastRequestAt = lastRequestAtRaw ? Number(lastRequestAtRaw) : 0;

      if (
        Number.isFinite(lastRequestAt) &&
        lastRequestAt > 0 &&
        now - lastRequestAt < config.minIntervalMs
      ) {
        const retryAfterSeconds = Math.ceil(
          (config.minIntervalMs - (now - lastRequestAt)) / 1000,
        );
        return {
          allowed: false,
          reason: `下载过于频繁，请 ${retryAfterSeconds} 秒后重试`,
          retryAfterSeconds,
          statusCode: 429,
        };
      }

      const currentCount = await this.withTimeout(redisClient.incr(countKey));
      if (currentCount === 1) {
        await this.withTimeout(redisClient.pExpire(countKey, config.windowMs));
      }

      await this.withTimeout(
        redisClient.set(lastRequestKey, String(now), {
          PX: config.windowMs,
        }),
      );

      if (currentCount > config.maxRequests) {
        const ttlMs = await this.withTimeout(redisClient.pTTL(countKey));
        const retryAfterSeconds =
          ttlMs > 0 ? Math.max(1, Math.ceil(ttlMs / 1000)) : 60;
        return {
          allowed: false,
          reason: '游客下载次数已达上限，请稍后再试或登录账号继续下载',
          retryAfterSeconds,
          statusCode: 429,
        };
      }

      return { allowed: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`游客下载限流检查失败: ${message}`);
      return {
        allowed: false,
        reason: '限流服务暂时不可用，请稍后重试',
        statusCode: 503,
      };
    }
  }

  private buildCountKey(
    guestKey: string,
    currentMs: number,
    windowMs: number,
  ): string {
    const bucketStart = Math.floor(currentMs / windowMs) * windowMs;
    return `download:guest:count:${guestKey}:${bucketStart}`;
  }

  async ping(): Promise<{
    status: 'healthy' | 'unhealthy';
    error?: string;
  }> {
    const redisClient = this.client;
    if (!redisClient || !redisClient.isReady) {
      return {
        status: 'unhealthy',
        error: 'Redis 未连接',
      };
    }

    try {
      const result = await this.withTimeout(redisClient.ping());
      return result === 'PONG'
        ? { status: 'healthy' }
        : { status: 'unhealthy', error: `Redis ping 返回异常: ${result}` };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Redis 操作超时'));
        }, this.operationTimeoutMs);
      }),
    ]);
  }
}
