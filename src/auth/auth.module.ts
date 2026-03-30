import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import {
  getAccessTokenExpiresIn,
  getJwtSecretOrThrow,
} from 'src/config/security.config';

@Module({
  imports: [
    DatabaseModule,
    LogsModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        void configService;
        return {
          secret: getJwtSecretOrThrow(),
          signOptions: { expiresIn: getAccessTokenExpiresIn() },
        };
      },
    }),
  ],
  controllers: [UserController, AdminUserController],
  providers: [UserService, AuthService, UserUuidService, JwtStrategy],
  exports: [UserService, AuthService, UserUuidService],
})
export class AuthModule {}
