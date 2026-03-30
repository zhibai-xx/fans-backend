import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

type AuthenticatedUser = {
  id: number;
  username: string;
  role: string;
};

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest<TUser = AuthenticatedUser | null>(
    err: unknown,
    user: TUser,
    _info: unknown,
    _context: ExecutionContext,
    _status?: unknown,
  ): TUser {
    void _info;
    void _context;
    void _status;
    if (err) {
      const errorToThrow =
        err instanceof Error ? err : new UnauthorizedException('未授权访问');
      throw errorToThrow;
    }
    return (user ?? null) as TUser;
  }
}
