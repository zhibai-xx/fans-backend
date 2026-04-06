import { AppController } from '../../../src/app.controller';
import { AppService } from '../../../src/app.service';

describe('AppController • health endpoint', () => {
  it('returns healthy status when database check is healthy', async () => {
    const appService = new AppService();
    const databaseService = {
      healthCheck: jest.fn().mockResolvedValue({
        status: 'healthy',
        timestamp: new Date(),
      }),
    };
    const guestDownloadRateLimitService = {
      ping: jest.fn().mockResolvedValue({
        status: 'healthy',
      }),
    };

    const controller = new AppController(
      appService,
      databaseService as never,
      guestDownloadRateLimitService as never,
    );
    const response = await controller.getHealth();

    expect(response.status).toBe('healthy');
    expect(response.success).toBe(true);
    expect(response.checks.database.status).toBe('healthy');
    expect(response.checks.redis.status).toBe('healthy');
  });

  it('returns unhealthy status when database check fails', async () => {
    const appService = new AppService();
    const databaseService = {
      healthCheck: jest.fn().mockResolvedValue({
        status: 'unhealthy',
        error: 'connection failed',
        timestamp: new Date(),
      }),
    };
    const guestDownloadRateLimitService = {
      ping: jest.fn().mockResolvedValue({
        status: 'healthy',
      }),
    };

    const controller = new AppController(
      appService,
      databaseService as never,
      guestDownloadRateLimitService as never,
    );
    const response = await controller.getHealth();

    expect(response.status).toBe('unhealthy');
    expect(response.success).toBe(false);
    expect(response.checks.database.status).toBe('unhealthy');
    expect(response.checks.database.error).toBe('connection failed');
    expect(response.checks.redis.status).toBe('healthy');
  });
});
