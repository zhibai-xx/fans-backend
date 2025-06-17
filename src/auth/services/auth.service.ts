import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from './user.service';
import { LoginDto } from '../dto/login.dto';
import { UserResponseDto } from '../dto/user-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) { }

  async validateUser(username: string, password: string): Promise<any> {
    const user = await this.userService.login({ username, password } as LoginDto);
    return user;
  }

  async login(user: any) {
    // JWT payload包含内部ID（用于性能）和UUID（用于安全）
    const payload = {
      username: user.username,
      sub: user.id,  // 内部ID用于数据库查询性能
      uuid: user.uuid  // UUID用于外部API安全
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: new UserResponseDto(user),
    };
  }
} 