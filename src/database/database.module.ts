import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Module({
  providers: [DatabaseService],  // 提供DatabaseService服务
  exports: [DatabaseService]     // 导出DatabaseService，使其他模块可以使用它
})
export class DatabaseModule {}
