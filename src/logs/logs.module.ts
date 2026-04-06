import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { LogsService } from './services/logs.service';
import { LoginLogService } from './services/login-log.service';

@Module({
  imports: [DatabaseModule],
  providers: [LogsService, LoginLogService],
  exports: [LogsService, LoginLogService],
})
export class LogsModule {}
