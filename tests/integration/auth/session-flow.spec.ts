import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../../../src/auth/services/auth.service';

type TestUser = {
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

const createTestUser = (): TestUser => ({
  id: 1,
  uuid: 'test-user-uuid-1',
  username: 'tester',
  email: 'tester@example.com',
  password: 'hashed-password',
  phoneNumber: null,
  nickname: '测试用户',
  avatar_url: null,
  role: 'USER',
  status: 'ACTIVE',
  session_version: 0,
  created_at: new Date('2026-02-12T10:00:00.000Z'),
  updated_at: new Date('2026-02-12T10:00:00.000Z'),
});

describe('Integration • Auth session flow', () => {
  it('supports login/refresh/logout and invalidates stale sessions', async () => {
    const state = {
      user: createTestUser(),
    };

    const userService = {
      login: jest.fn(async () => state.user),
      findById: jest.fn(async () => state.user),
      bumpSessionVersion: jest.fn(async () => {
        state.user = {
          ...state.user,
          session_version: state.user.session_version + 1,
          updated_at: new Date(),
        };
        return state.user;
      }),
    };

    const jwtService = new JwtService({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '15m' },
    });

    const authService = new AuthService(userService as never, jwtService);

    const firstLogin = await authService.login(state.user);
    expect(firstLogin.access_token).toBeTruthy();
    expect(firstLogin.refresh_token).toBeTruthy();

    const firstRefresh = await authService.refreshAccessToken(
      firstLogin.refresh_token,
    );
    expect(firstRefresh.access_token).toBeTruthy();
    expect(firstRefresh.refresh_token).toBeTruthy();

    const secondLogin = await authService.login(state.user);
    expect(secondLogin.refresh_token).toBeTruthy();

    await expect(
      authService.refreshAccessToken(firstLogin.refresh_token),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    await authService.logout(state.user.id);

    await expect(
      authService.refreshAccessToken(secondLogin.refresh_token),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
