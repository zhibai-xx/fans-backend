import { Module } from '@nestjs/common';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [DatabaseModule, AuthModule, MediaModule],
  controllers: [AdminDashboardController],
  providers: [AdminDashboardService],
  exports: [AdminDashboardService],
})
export class AdminDashboardModule { }