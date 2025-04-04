import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { DatabaseModule } from 'src/database/database.module';

@Module({
    imports: [DatabaseModule],  // 导入数据库模块，使用其提供的服务
    controllers: [UsersController],  // 注册用户控制器，处理用户相关的HTTP请求
    providers: [UsersService]        // 提供用户服务，实现用户相关的业务逻辑
})
export class UsersModule { }
