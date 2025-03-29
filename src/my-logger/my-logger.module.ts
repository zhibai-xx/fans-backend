import { Module } from '@nestjs/common';
import { MyLoggerService } from './my-logger.service';

@Module({
  providers: [MyLoggerService],  // 提供自定义日志服务
  exports: [MyLoggerService]     // 导出日志服务，使其他模块可以使用它
})
export class MyLoggerModule { }
