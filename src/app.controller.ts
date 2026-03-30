import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { DatabaseService } from './database/database.service';
import { GuestDownloadRateLimitService } from './media/services/guest-download-rate-limit.service';

type HealthResponse = {
  success: boolean;
  status: 'healthy' | 'unhealthy';
  service: string;
  timestamp: string;
  uptime: number;
  checks: {
    database: {
      status: 'healthy' | 'unhealthy';
      error?: string;
    };
    redis: {
      status: 'healthy' | 'unhealthy';
      error?: string;
    };
  };
};

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly databaseService: DatabaseService,
    private readonly guestDownloadRateLimitService: GuestDownloadRateLimitService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async getHealth(): Promise<HealthResponse> {
    const [databaseHealth, redisHealth] = await Promise.all([
      this.databaseService.healthCheck(),
      this.guestDownloadRateLimitService.ping(),
    ]);
    const databaseStatus =
      databaseHealth.status === 'healthy' ? 'healthy' : 'unhealthy';
    const redisStatus =
      redisHealth.status === 'healthy' ? 'healthy' : 'unhealthy';
    const serviceStatus: 'healthy' | 'unhealthy' =
      databaseStatus === 'healthy' && redisStatus === 'healthy'
        ? 'healthy'
        : 'unhealthy';

    return {
      success: serviceStatus === 'healthy',
      status: serviceStatus,
      service: 'fans-backend',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      checks: {
        database: {
          status: databaseStatus,
          ...(databaseStatus === 'unhealthy' &&
          typeof databaseHealth.error === 'string'
            ? { error: databaseHealth.error }
            : {}),
        },
        redis: {
          status: redisStatus,
          ...(redisStatus === 'unhealthy' &&
          typeof redisHealth.error === 'string'
            ? { error: redisHealth.error }
            : {}),
        },
      },
    };
  }
}
