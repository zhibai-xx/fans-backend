import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UserService } from './services/user.service';
import { AuthService } from './services/auth.service';
import { UserUuidService } from './services/user-uuid.service';
import { UserController } from './controllers/user.controller';
import { AdminUserController } from './controllers/admin-user.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { DatabaseModule } from 'src/database/database.module';
import { LogsModule } from 'src/logs/logs.module';

@Module({
  imports: [
    DatabaseModule,
    LogsModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '30d' },
    }),
  ],
  controllers: [UserController, AdminUserController],
  providers: [UserService, AuthService, UserUuidService, JwtStrategy],
  exports: [UserService, AuthService, UserUuidService],
})
export class AuthModule { } 