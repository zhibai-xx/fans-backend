import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { UserUploadController } from './controllers/user-upload.controller';
import { MediaService } from './media.service';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from 'src/database/database.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AuthModule,
  ],
  controllers: [MediaController, UserUploadController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule { }
