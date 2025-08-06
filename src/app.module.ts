import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
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
import performanceConfig from './config/performance.config';
import { validate } from './config/env.validation';
import { AuthModule } from './auth/auth.module';
import { UploadModule } from './upload/upload.module';
import { PerformanceModule } from './common/performance.module';
import { PerformanceMiddleware } from './common/middleware/performance.middleware';
import { LogsModule } from './logs/logs.module';
import { AdminDashboardModule } from './admin/admin-dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [uploadConfig, ossConfig, performanceConfig],
      validate,
      envFilePath: ['.env'],
    }),
    DatabaseModule,
    EmployeesModule,
    ThrottlerModule.forRoot([{
      name: 'short',
      ttl: 1000,
      limit: 10
    }, {
      name: 'medium',
      ttl: 10000,
      limit: 50
    }, {
      name: 'long',
      ttl: 60000,
      limit: 200
    }]),
    MyLoggerModule,
    MediaModule,
    AuthModule,
    UploadModule,
    PerformanceModule,
    LogsModule,
    AdminDashboardModule,
  ],
  controllers: [AppController],
  providers: [AppService, {
    provide: APP_GUARD,
    useClass: ThrottlerGuard
  }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(PerformanceMiddleware)
      .forRoutes('*');
  }
}
