import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { LogsService } from '../../logs/services/logs.service';

@Injectable()
export class OperationLogMiddleware implements NestMiddleware {
  constructor(private readonly logsService: LogsService) { }

  use(req: Request, res: Response, next: NextFunction) {
    // 获取原始的 res.json 方法
    const originalJson = res.json;
    const logsService = this.logsService; // 保存引用到闭包中

    // 重写 res.json 方法
    res.json = function (body) {
      // 记录操作日志
      const user = (req as any).user;
      if (user && shouldLogOperation(req)) {
        const logData = extractLogData(req, res, body, user);
        // 异步记录日志，不阻塞响应
        setImmediate(() => {
          logsService.logOperation(logData).catch(console.error);
        });
      }

      // 调用原始的 json 方法
      return originalJson.call(this, body);
    };

    next();
  }
}

/**
 * 判断是否需要记录操作日志
 */
function shouldLogOperation(req: Request): boolean {
  const method = req.method;
  const path = req.path;

  // 只记录非GET请求的操作
  if (method === 'GET') {
    return false;
  }

  // 排除认证相关的请求（登录单独记录）
  if (path.includes('/auth/')) {
    return false;
  }

  // 排除上传进度查询等非实质性操作
  if (path.includes('/upload/progress') || path.includes('/upload/status')) {
    return false;
  }

  // 包含管理员操作
  if (path.includes('/admin/')) {
    return true;
  }

  // 包含用户重要操作
  const importantPaths = ['/media', '/upload', '/user', '/favorite', '/comment'];
  return importantPaths.some(importantPath => path.includes(importantPath));
}

/**
 * 提取操作日志数据
 */
function extractLogData(req: Request, res: Response, responseBody: any, user: any) {
  const method = req.method;
  const path = req.path;
  const statusCode = res.statusCode;

  // 解析操作信息
  const operationInfo = parseOperationInfo(method, path);

  // 判断操作结果
  let result: 'SUCCESS' | 'FAILED' | 'PARTIAL' = 'SUCCESS';
  let error_message: string | undefined;

  if (statusCode >= 400) {
    result = 'FAILED';
    error_message = responseBody?.message || responseBody?.error || `HTTP ${statusCode}`;
  } else if (statusCode >= 200 && statusCode < 300) {
    result = 'SUCCESS';
  } else {
    result = 'PARTIAL';
  }

  // 获取IP地址
  const ip_address = getClientIp(req);

  // 获取User-Agent
  const user_agent = req.headers['user-agent'] || '';

  return {
    user_id: user.id,
    operation_type: operationInfo.operation_type,
    module: operationInfo.module,
    action: operationInfo.action,
    target_type: operationInfo.target_type,
    target_id: operationInfo.target_id,
    target_name: operationInfo.target_name,
    old_values: null, // 需要在具体的controller中设置
    new_values: req.body,
    ip_address,
    user_agent,
    description: operationInfo.description,
    result,
    error_message,
  };
}

/**
 * 解析操作信息
 */
function parseOperationInfo(method: string, path: string) {
  let operation_type: 'USER_ACTION' | 'MEDIA_ACTION' | 'ADMIN_ACTION' | 'SYSTEM_ACTION' = 'USER_ACTION';
  let module = 'unknown';
  let action = method.toLowerCase();
  let target_type: string | undefined;
  let target_id: string | undefined;
  let target_name: string | undefined;
  let description = `${method} ${path}`;

  // 管理员操作
  if (path.includes('/admin/')) {
    operation_type = 'ADMIN_ACTION';
  }

  // 解析模块
  if (path.includes('/media')) {
    module = 'media';
    target_type = 'media';
  } else if (path.includes('/user')) {
    module = 'users';
    target_type = 'user';
  } else if (path.includes('/tag')) {
    module = 'tags';
    target_type = 'tag';
  } else if (path.includes('/categor')) {
    module = 'categories';
    target_type = 'category';
  } else if (path.includes('/upload')) {
    module = 'upload';
    target_type = 'file';
  } else if (path.includes('/favorite')) {
    module = 'favorites';
    target_type = 'favorite';
  } else if (path.includes('/comment')) {
    module = 'comments';
    target_type = 'comment';
  }

  // 解析具体操作
  if (method === 'POST') {
    action = 'create';
    description = `创建${getModuleName(module)}`;
  } else if (method === 'PUT' || method === 'PATCH') {
    action = 'update';
    description = `更新${getModuleName(module)}`;
  } else if (method === 'DELETE') {
    action = 'delete';
    description = `删除${getModuleName(module)}`;
  }

  // 批量操作
  if (path.includes('/batch')) {
    action = `batch_${action}`;
    description = `批量${getActionName(action)}${getModuleName(module)}`;
  }

  // 状态更新
  if (path.includes('/status')) {
    action = 'update_status';
    description = `更新${getModuleName(module)}状态`;
  }

  // 提取ID
  const idMatch = path.match(/\/([a-f0-9-]{36}|\d+)(?:\/|$)/);
  if (idMatch) {
    target_id = idMatch[1];
  }

  return {
    operation_type,
    module,
    action,
    target_type,
    target_id,
    target_name,
    description,
  };
}

/**
 * 获取模块中文名称
 */
function getModuleName(module: string): string {
  const moduleNames = {
    media: '媒体',
    users: '用户',
    tags: '标签',
    categories: '分类',
    upload: '文件',
    favorites: '收藏',
    comments: '评论',
  };
  return moduleNames[module] || module;
}

/**
 * 获取操作中文名称
 */
function getActionName(action: string): string {
  if (action.includes('create')) return '创建';
  if (action.includes('update')) return '更新';
  if (action.includes('delete')) return '删除';
  return action;
}

/**
 * 获取客户端真实IP地址
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded
    ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0])
    : req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';

  return ip.replace(/^::ffff:/, ''); // 移除IPv6前缀
}