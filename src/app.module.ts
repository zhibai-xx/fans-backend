import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { EmployeesModule } from './employees/employees.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { MyLoggerModule } from './my-logger/my-logger.module';
import { MediaModule } from './media/media.module';
import { ConfigModule } from '@nestjs/config';
import uploadConfig from './config/upload.config';
import ossConfig from './config/oss.config';
import { validate } from './config/env.validation'; // 如果添加了验证
import { AuthModule } from './auth/auth.module';
import { UploadModule } from './upload/upload.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,       // 全局可用
      load: [uploadConfig, ossConfig], // 加载自定义配置
      validate, // 启用环境变量验证（可选）
      envFilePath: ['.env'],  // 指定环境文件路径
    }),
    DatabaseModule,  // 数据库模块，提供数据库连接服务
    EmployeesModule,  // 员工模块，处理员工相关功能
    ThrottlerModule.forRoot([{  // 限流模块配置，防止API过度使用
      name: 'short',  // 短期限流策略
      ttl: 1000,  // 1秒内
      limit: 10  // 最多允许10个请求（上传需要更多请求）
    }, {
      name: 'medium',  // 中期限流策略
      ttl: 10000,  // 10秒内
      limit: 50  // 最多允许50个请求
    }, {
      name: 'long',  // 长期限流策略
      ttl: 60000,  // 1分钟内
      limit: 200  // 最多允许200个请求（上传测试需要更多）
    }]),
    MyLoggerModule, // 自定义日志模块
    MediaModule,  // 媒体模块
    AuthModule, UploadModule,
  ],
  controllers: [AppController],  // 应用主控制器
  providers: [AppService, {  // 应用服务提供者和全局守卫
    provide: APP_GUARD,  // 注册全局守卫
    useClass: ThrottlerGuard  // 使用限流守卫
  }],
})
export class AppModule { }
