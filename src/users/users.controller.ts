import { UsersService } from './users.service';
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, ParseIntPipe, ValidationPipe } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users') // 定义控制器路由前缀为'users'
export class UsersController {

    constructor(private readonly usersService: UsersService) { } // 通过依赖注入引入用户服务

    @Get() // 处理GET /users 或 /users?role=ADMIN 请求
    findAll(@Query('role') role?: 'ADMIN' | 'INTERN' | 'ENGINEER') {
        // 获取所有用户，可选择按角色筛选
        return this.usersService.findAll(role)
    }
    // @Get('interns') // GET /users/interns 瀑布流的顺序很重要，不然会被下面的匹配规则:id覆盖
    // findAllInterns() {
    //     return []
    // }
    @Get(':id') // 处理GET /users/:id 请求
    findOne(@Param('id', ParseIntPipe) id: number) {
        // 获取特定ID的用户，使用ParseIntPipe将id参数转换为数字
        return this.usersService.findOne(id)
    }
    @Post() // 处理POST /users 请求
    create(@Body(ValidationPipe) createUserDto: CreateUserDto) {
        // 创建新用户，使用ValidationPipe验证请求体
        return this.usersService.create(createUserDto)
    }
    @Patch(':id') // 处理PATCH /users/:id 请求
    update(@Param('id', ParseIntPipe) id: number, @Body(ValidationPipe) updateUserDto: UpdateUserDto) {
        // 更新特定ID的用户，使用ValidationPipe验证请求体
        return this.usersService.update(id, updateUserDto)
    }
    @Delete(':id') // 处理DELETE /users/:id 请求
    delete(@Param('id', ParseIntPipe) id: number) {
        // 删除特定ID的用户
        return this.usersService.delete(id)
    }

}
