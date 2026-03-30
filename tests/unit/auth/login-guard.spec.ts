import { LoginLogService } from '../../../src/logs/services/login-log.service';

describe('Auth • Login guard', () => {
  it('blocks request when ip attempts exceed rate limit', async () => {
    const logsService = { logLogin: jest.fn() };
    const databaseService = {
      loginLog: {
        count: jest
          .fn()
          .mockResolvedValueOnce(999) // ip attempts in window
          .mockResolvedValueOnce(0), // ip failures in lock window
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    const service = new LoginLogService(
      logsService as never,
      databaseService as never,
    );

    const result = await service.checkLoginAllowed({
      ipAddress: '127.0.0.1',
      username: 'tester',
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('IP 请求频率过高');
  });

  it('blocks request when existing user failure count exceeds threshold', async () => {
    const logsService = { logLogin: jest.fn() };
    const databaseService = {
      loginLog: {
        count: jest
          .fn()
          .mockResolvedValueOnce(1) // ip attempts in window
          .mockResolvedValueOnce(1) // ip failures in lock window
          .mockResolvedValueOnce(999), // user failures in lock window
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 1001 }),
      },
    };

    const service = new LoginLogService(
      logsService as never,
      databaseService as never,
    );

    const result = await service.checkLoginAllowed({
      ipAddress: '127.0.0.1',
      username: 'tester',
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('账户登录失败次数过多');
  });

  it('allows request when counters are under threshold', async () => {
    const logsService = { logLogin: jest.fn() };
    const databaseService = {
      loginLog: {
        count: jest
          .fn()
          .mockResolvedValueOnce(1) // ip attempts in window
          .mockResolvedValueOnce(1) // ip failures in lock window
          .mockResolvedValueOnce(1), // user failures in lock window
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 1001 }),
      },
    };

    const service = new LoginLogService(
      logsService as never,
      databaseService as never,
    );

    const result = await service.checkLoginAllowed({
      ipAddress: '127.0.0.1',
      username: 'tester',
    });

    expect(result.allowed).toBe(true);
  });
});
