import { Module } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],  // 导入数据库模块，使用其提供的服务
  controllers: [EmployeesController],  // 注册员工控制器，处理员工相关的HTTP请求
  providers: [EmployeesService],  // 提供员工服务，实现员工相关的业务逻辑
})
export class EmployeesModule {}
