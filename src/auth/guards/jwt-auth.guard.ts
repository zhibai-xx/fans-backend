import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { Request } from 'express';

type AuthenticatedUser = {
  id: number;
  username: string;
  role: string;
};

type RequestWithUser = Request & {
  user?: AuthenticatedUser;
};

type AuthInfo = {
  message?: string;
};

const getUserLabel = (user: unknown): string => {
  if (user && typeof user === 'object') {
    const username = (user as Record<string, unknown>).username;
    if (typeof username === 'string') {
      return username;
    }
  }
  return '无';
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return '未知错误';
};

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest<unknown>();
    const typedRequest =
      request && typeof request === 'object'
        ? (request as RequestWithUser)
        : undefined;
    const authHeader = typedRequest?.headers?.authorization;
    const authHeaderValue =
      typeof authHeader === 'string'
        ? authHeader
        : Array.isArray(authHeader)
          ? authHeader[0]
          : undefined;
    const authPreview = authHeaderValue
      ? `${authHeaderValue.slice(0, 20)}...`
      : '无';
    const requestPath = typedRequest?.path ?? 'unknown';

    this.logger.debug(
      `JWT认证 - 路径: ${requestPath}, Authorization头: ${authPreview}`,
    );

    return super.canActivate(context);
  }

  handleRequest<TUser = AuthenticatedUser>(
    err: unknown,
    user: TUser,
    info: AuthInfo | undefined,
    _context: ExecutionContext,
    _status?: unknown,
  ): TUser {
    void _context;
    void _status;
    const errMessage = getErrorMessage(err);
    const infoMessage = info?.message ?? '无';
    const userLabel = getUserLabel(user);
    this.logger.debug(
      `JWT验证结果 - 错误: ${errMessage}, 用户: ${userLabel}, 信息: ${infoMessage}`,
    );

    if (err || !user) {
      this.logger.warn(
        `JWT认证失败: ${errMessage !== '未知错误' ? errMessage : infoMessage}`,
      );
      const errorToThrow =
        err instanceof Error ? err : new UnauthorizedException(infoMessage);
      throw errorToThrow;
    }

    if (user && typeof user === 'object') {
      const username = (user as Record<string, unknown>).username;
      const role = (user as Record<string, unknown>).role;
      if (typeof username === 'string' && typeof role === 'string') {
        this.logger.log(`JWT认证成功: 用户 ${username} (${role})`);
      }
    }
    return user;
  }
}
