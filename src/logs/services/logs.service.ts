import { Injectable } from '@nestjs/common';
import {
  LoginResult,
  LoginType,
  OperationResult,
  OperationType,
  Prisma,
} from '@prisma/client';
import { DatabaseService } from '../../database/database.service';

type OperationLogFilters = {
  operation_type?: string;
  module?: string;
  action?: string;
  result?: string;
  user_id?: number | string;
  start_date?: string;
  end_date?: string;
};

type LoginLogFilters = {
  login_type?: string;
  result?: string;
  user_id?: number | string;
  ip_address?: string;
  start_date?: string;
  end_date?: string;
};

type DateCountRow = {
  date: Date;
  count: bigint;
};

type UserActivityRow = {
  id: number;
  username: string;
  nickname: string | null;
  email: string | null;
  role: string;
  operation_count: bigint;
  modules_count: bigint;
  last_operation_at: Date | null;
};

type TotalRow = {
  total: bigint;
};

type OperationLogRecord = Prisma.OperationLogGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        username: true;
        nickname: true;
        email: true;
        role: true;
      };
    };
  };
}>;

type LoginLogRecord = Prisma.LoginLogGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        username: true;
        nickname: true;
        email: true;
        role: true;
      };
    };
  };
}>;

export type PaginatedResult<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type OperationStatsResult = {
  totalCount: number;
  successRate: number;
  operationTypeStats: Array<{ type: OperationType; count: number }>;
  moduleStats: Array<{ module: string; count: number }>;
  resultStats: Array<{ result: OperationResult; count: number }>;
  dateStats: Array<{ date: Date; count: number }>;
};

export type LoginStatsResult = {
  totalCount: number;
  successRate: number;
  uniqueIpCount: number;
  loginTypeStats: Array<{ type: LoginType; count: number }>;
  resultStats: Array<{ result: LoginResult; count: number }>;
  dateStats: Array<{ date: Date; count: number }>;
};

export type UserActivityResult = PaginatedResult<
  Omit<UserActivityRow, 'operation_count' | 'modules_count'> & {
    operation_count: number;
    modules_count: number;
  }
>;

@Injectable()
export class LogsService {
  constructor(private prisma: DatabaseService) {}

  /**
   * 获取操作日志列表
   */
  async getOperationLogs(
    filters: OperationLogFilters,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResult<OperationLogRecord>> {
    const where: Prisma.OperationLogWhereInput = {};

    const { operation_type } = filters;
    if (operation_type && isOperationType(operation_type)) {
      where.operation_type = operation_type;
    }
    if (filters.module) {
      where.module = filters.module;
    }
    if (filters.action) {
      where.action = filters.action;
    }
    if (filters.result && isOperationResult(filters.result)) {
      where.result = filters.result;
    }
    const userId = parseNumber(filters.user_id);
    if (userId !== undefined) {
      where.user_id = userId;
    }

    const dateFilter = buildDateFilter(filters.start_date, filters.end_date);
    if (dateFilter) {
      where.created_at = dateFilter;
    }

    const skip = (page - 1) * limit;

    // 获取总数
    const total = await this.prisma.operationLog.count({ where });

    // 获取数据
    const data = await this.prisma.operationLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      skip,
      take: limit,
    });

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 获取登录日志列表
   */
  async getLoginLogs(
    filters: LoginLogFilters,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResult<LoginLogRecord>> {
    const where: Prisma.LoginLogWhereInput = {};

    if (filters.login_type && isLoginType(filters.login_type)) {
      where.login_type = filters.login_type;
    }
    if (filters.result && isLoginResult(filters.result)) {
      where.result = filters.result;
    }
    const userId = parseNumber(filters.user_id);
    if (userId !== undefined) {
      where.user_id = userId;
    }
    if (filters.ip_address) {
      where.ip_address = {
        contains: filters.ip_address,
      };
    }

    const dateFilter = buildDateFilter(filters.start_date, filters.end_date);
    if (dateFilter) {
      where.created_at = dateFilter;
    }

    const skip = (page - 1) * limit;

    // 获取总数
    const total = await this.prisma.loginLog.count({ where });

    // 获取数据
    const data = await this.prisma.loginLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      skip,
      take: limit,
    });

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 获取操作日志统计
   */
  async getOperationStats(days: number = 30): Promise<OperationStatsResult> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 按操作类型统计
    const operationTypeStats = await this.prisma.operationLog.groupBy({
      by: ['operation_type'],
      where: {
        created_at: {
          gte: startDate,
        },
      },
      _count: {
        id: true,
      },
    });

    // 按模块统计
    const moduleStats = await this.prisma.operationLog.groupBy({
      by: ['module'],
      where: {
        created_at: {
          gte: startDate,
        },
      },
      _count: {
        id: true,
      },
    });

    // 按结果统计
    const resultStats = await this.prisma.operationLog.groupBy({
      by: ['result'],
      where: {
        created_at: {
          gte: startDate,
        },
      },
      _count: {
        id: true,
      },
    });

    // 按日期统计（最近7天）
    const dateStats = await this.prisma.$queryRaw<DateCountRow[]>`
      SELECT 
        created_at::date as date,
        COUNT(*) as count
      FROM "OperationLog"
      WHERE created_at >= ${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)}
      GROUP BY created_at::date
      ORDER BY created_at::date DESC
    `;

    // 总计
    const totalCount = await this.prisma.operationLog.count({
      where: {
        created_at: {
          gte: startDate,
        },
      },
    });

    // 成功率
    const successCount = await this.prisma.operationLog.count({
      where: {
        created_at: {
          gte: startDate,
        },
        result: 'SUCCESS',
      },
    });

    const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0;

    return {
      totalCount,
      successRate: Math.round(successRate * 100) / 100,
      operationTypeStats: operationTypeStats.map((item) => ({
        type: item.operation_type,
        count: item._count.id,
      })),
      moduleStats: moduleStats.map((item) => ({
        module: item.module,
        count: item._count.id,
      })),
      resultStats: resultStats.map((item) => ({
        result: item.result,
        count: item._count.id,
      })),
      dateStats: dateStats.map((item) => ({
        date: item.date,
        count: Number(item.count),
      })),
    };
  }

  /**
   * 获取登录日志统计
   */
  async getLoginStats(days: number = 30): Promise<LoginStatsResult> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 按登录方式统计
    const loginTypeStats = await this.prisma.loginLog.groupBy({
      by: ['login_type'],
      where: {
        created_at: {
          gte: startDate,
        },
      },
      _count: {
        id: true,
      },
    });

    // 按结果统计
    const resultStats = await this.prisma.loginLog.groupBy({
      by: ['result'],
      where: {
        created_at: {
          gte: startDate,
        },
      },
      _count: {
        id: true,
      },
    });

    // 按日期统计（最近7天）
    const dateStats = await this.prisma.$queryRaw<DateCountRow[]>`
      SELECT 
        created_at::date as date,
        COUNT(*) as count
      FROM "LoginLog"
      WHERE created_at >= ${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)}
      GROUP BY created_at::date
      ORDER BY created_at::date DESC
    `;

    // 总计
    const totalCount = await this.prisma.loginLog.count({
      where: {
        created_at: {
          gte: startDate,
        },
      },
    });

    // 成功率
    const successCount = await this.prisma.loginLog.count({
      where: {
        created_at: {
          gte: startDate,
        },
        result: 'SUCCESS',
      },
    });

    const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0;

    // 独立IP统计
    const uniqueIpCount = await this.prisma.loginLog.groupBy({
      by: ['ip_address'],
      where: {
        created_at: {
          gte: startDate,
        },
      },
    });

    return {
      totalCount,
      successRate: Math.round(successRate * 100) / 100,
      uniqueIpCount: uniqueIpCount.length,
      loginTypeStats: loginTypeStats.map((item) => ({
        type: item.login_type,
        count: item._count.id,
      })),
      resultStats: resultStats.map((item) => ({
        result: item.result,
        count: item._count.id,
      })),
      dateStats: dateStats.map((item) => ({
        date: item.date,
        count: Number(item.count),
      })),
    };
  }

  /**
   * 获取用户操作活跃度统计
   */
  async getUserActivityStats(
    days: number = 7,
    page: number = 1,
    limit: number = 20,
  ): Promise<UserActivityResult> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const skip = (page - 1) * limit;

    // 获取用户操作统计
    const userStats = await this.prisma.$queryRaw<UserActivityRow[]>`
      SELECT 
        u.id,
        u.username,
        u.nickname,
        u.email,
        u.role,
        COUNT(ol.id) as operation_count,
        COUNT(DISTINCT ol.module) as modules_count,
        MAX(ol.created_at) as last_operation_at
      FROM "User" u
      LEFT JOIN "OperationLog" ol ON u.id = ol.user_id 
        AND ol.created_at >= ${startDate}
      GROUP BY u.id, u.username, u.nickname, u.email, u.role
      HAVING COUNT(ol.id) > 0
      ORDER BY operation_count DESC
      LIMIT ${limit} OFFSET ${skip}
    `;

    // 获取总数
    const totalResult = await this.prisma.$queryRaw<TotalRow[]>`
      SELECT COUNT(DISTINCT u.id) as total
      FROM "User" u
      LEFT JOIN "OperationLog" ol ON u.id = ol.user_id 
        AND ol.created_at >= ${startDate}
      WHERE ol.id IS NOT NULL
    `;

    const total = totalResult.length > 0 ? Number(totalResult[0].total) : 0;

    return {
      data: userStats.map((item) => ({
        ...item,
        operation_count: Number(item.operation_count),
        modules_count: Number(item.modules_count),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 记录操作日志
   */
  async logOperation(data: {
    user_id: number;
    operation_type: OperationType;
    module: string;
    action: string;
    target_type?: string;
    target_id?: string;
    target_name?: string;
    old_values?: Prisma.JsonValue;
    new_values?: Prisma.JsonValue;
    ip_address?: string;
    user_agent?: string;
    description?: string;
    result?: OperationResult;
    error_message?: string;
  }): Promise<Prisma.OperationLogGetPayload<object>> {
    const payload: Prisma.OperationLogUncheckedCreateInput = {
      user_id: data.user_id,
      operation_type: data.operation_type,
      module: data.module,
      action: data.action,
      target_type: data.target_type ?? '',
      target_id: data.target_id,
      target_name: data.target_name,
      old_values: normalizeJsonInput(data.old_values),
      new_values: normalizeJsonInput(data.new_values),
      ip_address: data.ip_address,
      user_agent: data.user_agent,
      description: data.description,
      result: data.result ?? OperationResult.SUCCESS,
      error_message: data.error_message,
    };

    return this.prisma.operationLog.create({
      data: payload,
    });
  }

  /**
   * 记录登录日志
   */
  async logLogin(data: {
    user_id?: number;
    login_type: LoginType;
    ip_address: string;
    user_agent: string;
    location?: string;
    result: LoginResult;
    fail_reason?: string;
  }): Promise<Prisma.LoginLogGetPayload<object>> {
    const payload: Prisma.LoginLogUncheckedCreateInput = {
      user_id: data.user_id ?? null,
      login_type: data.login_type,
      ip_address: data.ip_address,
      user_agent: data.user_agent,
      location: data.location,
      result: data.result,
      fail_reason: data.fail_reason,
    };

    return this.prisma.loginLog.create({
      data: payload,
    });
  }
}

const buildDateFilter = (
  start?: string,
  end?: string,
): Prisma.DateTimeFilter | undefined => {
  const range: Prisma.DateTimeFilter = {};
  const startDate = parseDate(start);
  const endDate = parseDate(end);

  if (startDate) {
    range.gte = startDate;
  }
  if (endDate) {
    range.lte = endDate;
  }

  return Object.keys(range).length > 0 ? range : undefined;
};

const parseNumber = (value?: number | string): number | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'number') {
    return Number.isNaN(value) ? undefined : value;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const parseDate = (value?: string): Date | undefined => {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const isOperationType = (value: string): value is OperationType =>
  Object.values(OperationType).includes(value as OperationType);

const isOperationResult = (value: string): value is OperationResult =>
  Object.values(OperationResult).includes(value as OperationResult);

const isLoginType = (value: string): value is LoginType =>
  Object.values(LoginType).includes(value as LoginType);

const isLoginResult = (value: string): value is LoginResult =>
  Object.values(LoginResult).includes(value as LoginResult);

const normalizeJsonInput = (
  value?: Prisma.JsonValue,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
};
