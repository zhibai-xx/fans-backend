import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Ip } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { Prisma } from '@prisma/client';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { MyLoggerService } from 'src/my-logger/my-logger.service';

@SkipThrottle()  // 跳过整个控制器的默认限流设置
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) { }
  private readonly logger = new MyLoggerService(EmployeesController.name)  // 使用自定义日志服务

  /** 
  @Post()  // 处理POST /employees 请求，创建员工
  create(@Body() createEmployeeDto: Prisma.EmployeeCreateInput) {
    return this.employeesService.create(createEmployeeDto);
  }

  @SkipThrottle({ default: false })  // 强制启用默认速率限制，覆盖控制器级别的设置
  @Get()  // 处理GET /employees 或 /employees?role=ADMIN 请求，获取所有员工
  findAll(@Ip() ip: string, @Query('role') role?: Role) {
    // 记录请求日志，包含IP地址
    this.logger.log(`Request for ALL Employees\t${ip}`, EmployeesController.name)
    return this.employeesService.findAll(role);
  }

  @Throttle({ short: { ttl: 1000, limit: 1 } })  // 自定义限流：1秒内最多1个请求
  @Get(':id')  // 处理GET /employees/:id 请求，获取特定ID的员工
  findOne(@Param('id') id: string) {
    return this.employeesService.findOne(+id);
  }

  @Patch(':id')  // 处理PATCH /employees/:id 请求，更新特定ID的员工
  update(@Param('id') id: string, @Body() updateEmployeeDto: Prisma.EmployeeUpdateInput) {
    return this.employeesService.update(+id, updateEmployeeDto);
  }

  @Delete(':id')  // 处理DELETE /employees/:id 请求，删除特定ID的员工
  remove(@Param('id') id: string) {
    return this.employeesService.remove(+id);
  }
  */
}
