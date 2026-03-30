import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { UserController } from '../../../src/auth/controllers/user.controller';
import { UserService } from '../../../src/auth/services/user.service';
import { AuthService } from '../../../src/auth/services/auth.service';
import { LoginLogService } from '../../../src/logs/services/login-log.service';

type LoginUser = {
  id: number;
  uuid: string;
  username: string;
  email: string;
  password: string;
  phoneNumber: string | null;
  nickname: string | null;
  avatar_url: string | null;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'SUSPENDED';
  session_version: number;
  created_at: Date;
  updated_at: Date;
};

const buildUser = (): LoginUser => ({
  id: 1,
  uuid: 'user-uuid-1',
  username: 'tester',
  email: 'tester@example.com',
  password: 'hashed-password',
  phoneNumber: null,
  nickname: '测试账号',
  avatar_url: null,
  role: 'USER',
  status: 'ACTIVE',
  session_version: 1,
  created_at: new Date('2026-02-12T00:00:00.000Z'),
  updated_at: new Date('2026-02-12T00:00:00.000Z'),
});

const describeHttpE2E =
  process.env.ALLOW_SOCKET_TESTS === 'true' ? describe : describe.skip;

describeHttpE2E('Integration • Auth HTTP', () => {
  let app: INestApplication;

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
      allowed: true,
      retryAfterSeconds: undefined,
    }),
    logLoginAttempt: jest.fn().mockResolvedValue(undefined),
    extractIpAddress: jest.fn().mockReturnValue('127.0.0.1'),
    extractUserAgent: jest.fn().mockReturnValue('jest-supertest'),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: UserService, useValue: userService },
        { provide: AuthService, useValue: authService },
        { provide: LoginLogService, useValue: loginLogService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/users/login returns access and refresh token', async () => {
    const user = buildUser();
    userService.login.mockResolvedValue(user);
    authService.login.mockResolvedValue({
      access_token: 'access-token-http',
      refresh_token: 'refresh-token-http',
      user: {
        id: user.id,
        uuid: user.uuid,
        username: user.username,
        email: user.email,
      },
    });

    const response = await request(app.getHttpAdapter().getInstance())
      .post('/api/users/login')
      .send({ username: 'tester', password: 'password123' })
      .expect(201);

    expect(loginLogService.checkLoginAllowed).toHaveBeenCalledWith({
      ipAddress: '127.0.0.1',
      username: 'tester',
    });
    expect(userService.login).toHaveBeenCalledWith({
      username: 'tester',
      password: 'password123',
    });
    expect(authService.login).toHaveBeenCalled();
    expect(response.body.access_token).toBe('access-token-http');
    expect(response.body.refresh_token).toBe('refresh-token-http');
  });

  it('POST /api/users/refresh-token returns new token pair', async () => {
    authService.refreshAccessToken.mockResolvedValue({
      access_token: 'access-token-refresh',
      refresh_token: 'refresh-token-refresh',
    });

    const response = await request(app.getHttpAdapter().getInstance())
      .post('/api/users/refresh-token')
      .send({ refresh_token: 'refresh-token-http' })
      .expect(201);

    expect(authService.refreshAccessToken).toHaveBeenCalledWith(
      'refresh-token-http',
    );
    expect(response.body).toEqual({
      access_token: 'access-token-refresh',
      refresh_token: 'refresh-token-refresh',
    });
  });
});
