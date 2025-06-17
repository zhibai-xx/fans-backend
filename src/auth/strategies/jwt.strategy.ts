import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from '../services/user.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private userService: UserService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
    });
  }

  async validate(payload: any) {
    const user = await this.userService.findById(parseInt(payload.sub));
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }
    // 验证UUID是否匹配（额外安全检查）
    if (payload.uuid && user.uuid !== payload.uuid) {
      throw new UnauthorizedException('令牌无效');
    }
    return user;
  }
} 