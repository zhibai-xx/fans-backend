import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../auth/guards/admin-role.guard';
import {
  LoginStatsResult,
  LogsService,
  OperationStatsResult,
  PaginatedResult,
  UserActivityResult,
} from '../../logs/services/logs.service';

type OperationLogsQuery = {
  operation_type?: string;
  module?: string;
  action?: string;
  result?: string;
  user_id?: number;
  start_date?: string;
  end_date?: string;
};

type LoginLogsQuery = {
  login_type?: string;
  result?: string;
  user_id?: number;
  ip_address?: string;
  start_date?: string;
  end_date?: string;
};

const compactUndefined = <T extends Record<string, unknown>>(
  value: T,
): Partial<T> => {
  const entries = Object.entries(value).filter(
    ([, item]) => item !== undefined,
  );
  return Object.fromEntries(entries) as Partial<T>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const hasPagination = (
  value: unknown,
): value is PaginatedResult<unknown>['pagination'] =>
  isRecord(value) &&
  typeof value.page === 'number' &&
  typeof value.limit === 'number' &&
  typeof value.total === 'number' &&
  typeof value.totalPages === 'number';

const toPaginatedResult = (value: unknown): PaginatedResult<unknown> => {
  if (
    !isRecord(value) ||
    !Array.isArray(value.data) ||
    !hasPagination(value.pagination)
  ) {
    throw new Error('Invalid paginated result');
  }

  return {
    data: value.data,
    pagination: value.pagination,
  };
};

const toObjectResult = <T extends object>(value: unknown): T => {
  if (!isRecord(value)) {
    throw new Error('Invalid object result');
  }

  return value as T;
};

type LogsServiceLike = {
  getOperationLogs(
    filters: Partial<OperationLogsQuery>,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<unknown>>;
  getLoginLogs(
    filters: Partial<LoginLogsQuery>,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<unknown>>;
  getOperationStats(days: number): Promise<OperationStatsResult>;
  getLoginStats(days: number): Promise<LoginStatsResult>;
  getUserActivityStats(
    days: number,
    page: number,
    limit: number,
  ): Promise<UserActivityResult>;
};

const asLogsService = (service: LogsService): LogsServiceLike =>
  service as unknown as LogsServiceLike;

const fetchOperationLogs = async (
  service: LogsServiceLike,
  filters: Partial<OperationLogsQuery>,
  page: number,
  limit: number,
): Promise<PaginatedResult<unknown>> => {
  const result: unknown = await service.getOperationLogs(filters, page, limit);
  return toPaginatedResult(result);
};

const fetchLoginLogs = async (
  service: LogsServiceLike,
  filters: Partial<LoginLogsQuery>,
  page: number,
  limit: number,
): Promise<PaginatedResult<unknown>> => {
  const result: unknown = await service.getLoginLogs(filters, page, limit);
  return toPaginatedResult(result);
};

const fetchOperationStats = async (
  service: LogsServiceLike,
  days: number,
): Promise<OperationStatsResult> => {
  const result: unknown = await service.getOperationStats(days);
  return toObjectResult<OperationStatsResult>(result);
};

const fetchLoginStats = async (
  service: LogsServiceLike,
  days: number,
): Promise<LoginStatsResult> => {
  const result: unknown = await service.getLoginStats(days);
  return toObjectResult<LoginStatsResult>(result);
};

const fetchUserActivityStats = async (
  service: LogsServiceLike,
  days: number,
  page: number,
  limit: number,
): Promise<UserActivityResult> => {
  const result: unknown = await service.getUserActivityStats(days, page, limit);
  const paginated = toPaginatedResult(result);

  return {
    data: paginated.data,
    pagination: paginated.pagination,
  } as UserActivityResult;
};

@ApiTags('管理员 - 操作日志')
@Controller('admin/logs')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminLogsController {
  constructor(private readonly logsService: LogsService) {}

  /**
   * 获取操作日志列表
   */
  @Get('operations')
  @ApiOperation({ summary: '获取操作日志列表' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量' })
  @ApiQuery({
    name: 'operation_type',
    required: false,
    description: '操作类型',
  })
  @ApiQuery({ name: 'module', required: false, description: '操作模块' })
  @ApiQuery({ name: 'action', required: false, description: '具体操作' })
  @ApiQuery({ name: 'result', required: false, description: '操作结果' })
  @ApiQuery({ name: 'user_id', required: false, description: '用户ID' })
  @ApiQuery({ name: 'start_date', required: false, description: '开始日期' })
  @ApiQuery({ name: 'end_date', required: false, description: '结束日期' })
  async getOperationLogs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('operation_type') operation_type?: string,
    @Query('module') module?: string,
    @Query('action') action?: string,
    @Query('result') resultFilter?: string,
    @Query('user_id', new DefaultValuePipe(undefined)) user_id?: number,
    @Query('start_date') start_date?: string,
    @Query('end_date') end_date?: string,
  ) {
    const logsService = asLogsService(this.logsService);
    const filters: Partial<OperationLogsQuery> = compactUndefined({
      operation_type,
      module,
      action,
      result: resultFilter,
      user_id,
      start_date,
      end_date,
    });

    const operationResult = await fetchOperationLogs(
      logsService,
      filters,
      page,
      limit,
    );

    return {
      success: true,
      data: operationResult.data,
      pagination: operationResult.pagination,
    };
  }

  /**
   * 获取登录日志列表
   */
  @Get('logins')
  @ApiOperation({ summary: '获取登录日志列表' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量' })
  @ApiQuery({ name: 'login_type', required: false, description: '登录方式' })
  @ApiQuery({ name: 'result', required: false, description: '登录结果' })
  @ApiQuery({ name: 'user_id', required: false, description: '用户ID' })
  @ApiQuery({ name: 'ip_address', required: false, description: 'IP地址' })
  @ApiQuery({ name: 'start_date', required: false, description: '开始日期' })
  @ApiQuery({ name: 'end_date', required: false, description: '结束日期' })
  async getLoginLogs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('login_type') login_type?: string,
    @Query('result') resultFilter?: string,
    @Query('user_id', new DefaultValuePipe(undefined)) user_id?: number,
    @Query('ip_address') ip_address?: string,
    @Query('start_date') start_date?: string,
    @Query('end_date') end_date?: string,
  ) {
    const logsService = asLogsService(this.logsService);
    const filters: Partial<LoginLogsQuery> = compactUndefined({
      login_type,
      result: resultFilter,
      user_id,
      ip_address,
      start_date,
      end_date,
    });

    const loginResult = await fetchLoginLogs(logsService, filters, page, limit);

    return {
      success: true,
      data: loginResult.data,
      pagination: loginResult.pagination,
    };
  }

  /**
   * 获取操作日志统计
   */
  @Get('operations/stats')
  @ApiOperation({ summary: '获取操作日志统计' })
  @ApiQuery({
    name: 'days',
    required: false,
    description: '统计天数，默认30天',
  })
  async getOperationStats(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    const logsService = asLogsService(this.logsService);
    const stats = await fetchOperationStats(logsService, days);

    return {
      success: true,
      data: stats,
    };
  }

  /**
   * 获取登录日志统计
   */
  @Get('logins/stats')
  @ApiOperation({ summary: '获取登录日志统计' })
  @ApiQuery({
    name: 'days',
    required: false,
    description: '统计天数，默认30天',
  })
  async getLoginStats(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    const logsService = asLogsService(this.logsService);
    const stats = await fetchLoginStats(logsService, days);

    return {
      success: true,
      data: stats,
    };
  }

  /**
   * 获取用户操作统计
   */
  @Get('users/activity')
  @ApiOperation({ summary: '获取用户操作活跃度统计' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量' })
  @ApiQuery({ name: 'days', required: false, description: '统计天数，默认7天' })
  async getUserActivityStats(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number,
  ) {
    const logsService = asLogsService(this.logsService);
    const stats = await fetchUserActivityStats(logsService, days, page, limit);

    return {
      success: true,
      data: stats.data,
      pagination: stats.pagination,
    };
  }
}
