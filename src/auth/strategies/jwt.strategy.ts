import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';
import { UserService } from '../services/user.service';
import { getJwtSecretOrThrow } from 'src/config/security.config';

type JwtPayload = {
  sub?: string | number;
  username?: string;
  uuid?: string;
  sessionVersion?: number;
  type?: 'access' | 'refresh';
};

const resolveBearerToken = (request: Request): string | null => {
  const authHeader = request.headers.authorization;
  const authValue =
    typeof authHeader === 'string'
      ? authHeader
      : Array.isArray(authHeader)
        ? authHeader[0]
        : undefined;
  if (!authValue) {
    return null;
  }
  const [scheme, token] = authValue.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }
  return token;
};

type JwtStrategyOptions = ConstructorParameters<typeof Strategy>[0];
type JwtStrategyConstructor = new (options: JwtStrategyOptions) => Strategy;
const JwtStrategyBase = PassportStrategy(Strategy) as JwtStrategyConstructor;

@Injectable()
export class JwtStrategy extends JwtStrategyBase {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private userService: UserService) {
    const strategyOptions: JwtStrategyOptions = {
      jwtFromRequest: resolveBearerToken,
      ignoreExpiration: false,
      secretOrKey: getJwtSecretOrThrow(),
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- PassportStrategy 构造器类型来自第三方库，无法在此处进一步收敛
    super(strategyOptions);
  }

  async validate(payload: JwtPayload) {
    const subject = payload.sub;
    this.logger.debug(
      `JWT Payload解析: sub=${subject}, username=${payload.username ?? '无'}, uuid=${payload.uuid ?? '无'}`,
    );

    if (payload.type && payload.type !== 'access') {
      throw new UnauthorizedException('访问令牌类型无效');
    }

    const userId =
      typeof subject === 'string' ? Number.parseInt(subject, 10) : subject;
    const user = await this.userService.findById(Number(userId));
    if (!user) {
      this.logger.warn(`用户不存在: ID=${subject}`);
      throw new UnauthorizedException('用户不存在');
    }

    // 验证UUID是否匹配（额外安全检查）
    if (payload.uuid && user.uuid !== payload.uuid) {
      this.logger.warn(
        `UUID不匹配: Payload=${payload.uuid}, User=${user.uuid}`,
      );
      throw new UnauthorizedException('令牌无效');
    }

    if (
      typeof payload.sessionVersion !== 'number' ||
      payload.sessionVersion !== user.session_version
    ) {
      this.logger.warn(
        `会话版本不匹配: Payload=${payload.sessionVersion ?? '无'}, User=${user.session_version}`,
      );
      throw new UnauthorizedException('会话已失效，请重新登录');
    }

    this.logger.debug(`JWT验证成功: 用户 ${user.username} (${user.role})`);
    return user;
  }
}
