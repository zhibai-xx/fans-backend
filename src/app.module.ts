import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { DatabaseModule } from './database/database.module';
import { EmployeesModule } from './employees/employees.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { MyLoggerModule } from './my-logger/my-logger.module';

@Module({
  imports: [
    UsersModule,  // 用户模块，处理用户相关功能
    DatabaseModule,  // 数据库模块，提供数据库连接服务
    EmployeesModule,  // 员工模块，处理员工相关功能
    ThrottlerModule.forRoot([{  // 限流模块配置，防止API过度使用
      name: 'short',  // 短期限流策略
      ttl: 1000,  // 1秒内
      limit: 3  // 最多允许3个请求
    }, {
      name: 'long',  // 长期限流策略
      ttl: 60000,  // 1分钟内
      limit: 100  // 最多允许100个请求
    }]),
    MyLoggerModule  // 自定义日志模块
  ],
  controllers: [AppController],  // 应用主控制器
  providers: [AppService, {  // 应用服务提供者和全局守卫
    provide: APP_GUARD,  // 注册全局守卫
    useClass: ThrottlerGuard  // 使用限流守卫
  }],
})
export class AppModule { }
