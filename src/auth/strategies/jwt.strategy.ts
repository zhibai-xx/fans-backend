import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from '../services/user.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private userService: UserService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
    });
  }

  async validate(payload: any) {
    this.logger.debug(`JWT Payload解析: sub=${payload.sub}, username=${payload.username}, uuid=${payload.uuid}`);

    const user = await this.userService.findById(parseInt(payload.sub));
    if (!user) {
      this.logger.warn(`用户不存在: ID=${payload.sub}`);
      throw new UnauthorizedException('用户不存在');
    }

    // 验证UUID是否匹配（额外安全检查）
    if (payload.uuid && user.uuid !== payload.uuid) {
      this.logger.warn(`UUID不匹配: Payload=${payload.uuid}, User=${user.uuid}`);
      throw new UnauthorizedException('令牌无效');
    }

    this.logger.debug(`JWT验证成功: 用户 ${user.username} (${user.role})`);
    return user;
  }
} 