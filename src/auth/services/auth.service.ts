import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from './user.service';
import { LoginDto } from '../dto/login.dto';
import { UserResponseDto } from '../dto/user-response.dto';
import {
  getAccessTokenExpiresIn,
  getJwtRefreshSecretOrThrow,
  getRefreshTokenExpiresIn,
} from 'src/config/security.config';

type LoginUser = Awaited<ReturnType<UserService['login']>>;
type AuthTokenPayload = {
  username: string;
  sub: number;
  uuid: string;
  sessionVersion: number;
  type: 'access' | 'refresh';
};

@Injectable()
export class AuthService {
  private readonly userServiceRef: UserService;
  private readonly refreshSecret = getJwtRefreshSecretOrThrow();
  private readonly accessExpiresIn = getAccessTokenExpiresIn();
  private readonly refreshExpiresIn = getRefreshTokenExpiresIn();

  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {
    this.userServiceRef = userService;
  }

  async validateUser(username: string, password: string): Promise<LoginUser> {
    const loginPayload: LoginDto = {
      username,
      password,
    };
    const user = await this.userServiceRef.login(loginPayload);
    return user;
  }

  private buildTokenPayload(user: LoginUser, type: 'access' | 'refresh') {
    const payload: AuthTokenPayload = {
      username: user.username,
      sub: user.id,
      uuid: user.uuid,
      sessionVersion: user.session_version,
      type,
    };
    return payload;
  }

  private issueTokenPair(user: LoginUser) {
    const accessPayload = this.buildTokenPayload(user, 'access');
    const refreshPayload = this.buildTokenPayload(user, 'refresh');
    const accessToken = this.jwtService.sign(accessPayload, {
      expiresIn: this.accessExpiresIn,
    });
    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshExpiresIn,
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: new UserResponseDto(user),
    };
  }

  async login(user: LoginUser) {
    const latestUser = await this.userServiceRef.bumpSessionVersion(user.id);
    return this.issueTokenPair(latestUser);
  }

  async refreshAccessToken(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('缺少 refresh token');
    }

    type RefreshTokenPayload = {
      sub?: string | number;
      uuid?: string;
      sessionVersion?: number;
      type?: 'access' | 'refresh';
    };

    let payload: RefreshTokenPayload;
    try {
      payload = this.jwtService.verify<RefreshTokenPayload>(refreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('refresh token 无效或已过期');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('token 类型错误');
    }

    const subject = payload.sub;
    const userId =
      typeof subject === 'string' ? Number.parseInt(subject, 10) : subject;
    if (typeof userId !== 'number' || Number.isNaN(userId)) {
      throw new UnauthorizedException('refresh token 载荷无效');
    }

    const user = await this.userServiceRef.findById(userId);
    if (payload.uuid && user.uuid !== payload.uuid) {
      throw new UnauthorizedException('refresh token 与用户不匹配');
    }
    if (
      typeof payload.sessionVersion !== 'number' ||
      payload.sessionVersion !== user.session_version
    ) {
      throw new UnauthorizedException('refresh token 已失效，请重新登录');
    }

    const nextTokenPair = this.issueTokenPair(user);
    return {
      access_token: nextTokenPair.access_token,
      refresh_token: nextTokenPair.refresh_token,
    };
  }

  async logout(userId: number) {
    await this.userServiceRef.bumpSessionVersion(userId);
    return { success: true, message: '退出登录成功' };
  }
}
