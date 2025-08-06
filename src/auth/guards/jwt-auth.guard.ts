import { Injectable, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    this.logger.debug(`JWT认证 - 路径: ${request.path}, Authorization头: ${authHeader ? authHeader.substring(0, 20) + '...' : '无'}`);

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    this.logger.debug(`JWT验证结果 - 错误: ${err?.message || '无'}, 用户: ${user?.username || '无'}, 信息: ${info?.message || '无'}`);

    if (err || !user) {
      this.logger.warn(`JWT认证失败: ${err?.message || info?.message || '未知错误'}`);
      throw err || new UnauthorizedException('未授权访问');
    }

    this.logger.log(`JWT认证成功: 用户 ${user.username} (${user.role})`);
    return user;
  }
} 