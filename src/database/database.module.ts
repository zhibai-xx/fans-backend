import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { DatabasePerformanceService } from './database-performance.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [DatabaseService, DatabasePerformanceService],
  exports: [DatabaseService, DatabasePerformanceService],
})
export class DatabaseModule { }
