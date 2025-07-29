import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PerformanceController } from './controllers/performance.controller';
import { ResponseOptimizationInterceptor } from './interceptors/response-optimization.interceptor';

@Module({
  imports: [DatabaseModule],
  controllers: [PerformanceController],
  providers: [
    ResponseOptimizationInterceptor,
    // 暂时禁用全局响应优化拦截器，避免与异常过滤器冲突
    // {
    //   provide: APP_INTERCEPTOR,
    //   useClass: ResponseOptimizationInterceptor,
    // },
  ],
  exports: [ResponseOptimizationInterceptor],
})
export class PerformanceModule { } 