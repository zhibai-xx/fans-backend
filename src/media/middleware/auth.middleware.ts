import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DatabaseService } from 'src/database/database.service';

/**
 * 为Request对象扩展类型，添加user属性
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        role: string;
      };
    }
  }
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * 中间件实现，从请求中解析认证信息并加载用户
   * @param req 请求对象
   * @param res 响应对象
   * @param next 下一个中间件函数
   */
  async use(req: Request, res: Response, next: NextFunction) {
    // 从请求头或cookie中获取认证信息
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        // 这里应该实现真正的token验证和用户信息获取
        // 以下是模拟实现，实际项目中需要替换为JWT验证等机制
        
        // 模拟从token中提取用户ID
        const userId = parseInt(token.split('.')[0], 10);
        
        if (!isNaN(userId)) {
          // 从数据库加载用户信息
          const user = await this.databaseService.user.findUnique({
            where: { id: userId },
            select: {
              id: true,
              username: true,
              role: true
            }
          });
          
          if (user) {
            req.user = user;
          }
        }
      } catch (error) {
        // 认证失败时不设置req.user，但仍允许请求继续
        console.error('认证解析失败:', error);
      }
    }
    
    next();
  }
} 