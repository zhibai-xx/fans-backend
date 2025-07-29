import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  private readonly logger = new Logger(AdminRoleGuard.name);

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    this.logger.debug(`权限检查 - 请求路径: ${request.path}, 方法: ${request.method}`);

    if (!user) {
      this.logger.warn('权限被拒绝：用户未登录');
      throw new ForbiddenException('未授权访问：用户未登录');
    }

    this.logger.debug(`用户信息: ID=${user.id}, 用户名=${user.username}, 角色=${user.role}`);

    if (user.role !== 'ADMIN') {
      this.logger.warn(`权限被拒绝：用户 ${user.username} (${user.role}) 不是管理员`);
      throw new ForbiddenException('未授权访问：需要管理员权限');
    }

    this.logger.log(`权限验证成功：管理员 ${user.username} 访问 ${request.path}`);
    return true;
  }
} 