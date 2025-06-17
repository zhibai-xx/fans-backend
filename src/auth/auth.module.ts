import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UserService } from './services/user.service';
import { AuthService } from './services/auth.service';
import { UserUuidService } from './services/user-uuid.service';
import { UserController } from './controllers/user.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [
    DatabaseModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '30d' },
    }),
  ],
  controllers: [UserController],
  providers: [UserService, AuthService, UserUuidService, JwtStrategy],
  exports: [UserService, AuthService, UserUuidService],
})
export class AuthModule { } 