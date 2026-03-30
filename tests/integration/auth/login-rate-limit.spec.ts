import { HttpStatus } from '@nestjs/common';
import { UserController } from '../../../src/auth/controllers/user.controller';

describe('Integration • POST /api/users/login rate limit', () => {
  it('throws 429 and writes BLOCKED log when login guard rejects', async () => {
    const userService = {
      register: jest.fn(),
      login: jest.fn(),
      findById: jest.fn(),
      updateUser: jest.fn(),
      updateAvatar: jest.fn(),
      findByUuid: jest.fn(),
      changePassword: jest.fn(),
    };

    const authService = {
      login: jest.fn(),
      refreshAccessToken: jest.fn(),
      logout: jest.fn(),
    };

    const loginLogService = {
      checkLoginAllowed: jest.fn().mockResolvedValue({
        allowed: false,
        reason: 'IP 请求频率过高',
        retryAfterSeconds: 900,
      }),
      logLoginAttempt: jest.fn().mockResolvedValue(undefined),
      extractIpAddress: jest.fn().mockReturnValue('127.0.0.1'),
      extractUserAgent: jest.fn().mockReturnValue('jest-controller'),
    };

    const controller = new UserController(
      userService as never,
      authService as never,
      loginLogService as never,
    );

    const request = {
      headers: {},
      connection: { remoteAddress: '127.0.0.1' },
      socket: { remoteAddress: '127.0.0.1' },
    } as never;

    await expect(
      controller.login(
        { username: 'tester', password: 'password123' },
        request,
      ),
    ).rejects.toHaveProperty('status', HttpStatus.TOO_MANY_REQUESTS);

    expect(loginLogService.logLoginAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'BLOCKED',
        username: 'tester',
        fail_reason: 'IP 请求频率过高',
      }),
    );
  });
});
