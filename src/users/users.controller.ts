import { UsersService } from './users.service';
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, ParseIntPipe, ValidationPipe } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users') // 装饰器
export class UsersController {

    constructor(private readonly usersService: UsersService) { } // 引入服务，进行处理

    @Get() // GET /users or /users?role=ADMIN
    findAll(@Query('role') role?: 'ADMIN' | 'INTERN' | 'ENGINEER') {
        return this.usersService.findAll(role)
    }
    // @Get('interns') // GET /users/interns 瀑布流的顺序很重要，不然会被下面的匹配规则:id覆盖
    // findAllInterns() {
    //     return []
    // }
    @Get(':id') // GET /users/:id
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.usersService.findOne(id)
    }
    @Post() // POST /users
    create(@Body(ValidationPipe) createUserDto: CreateUserDto) {
        return this.usersService.create(createUserDto)
    }
    @Patch(':id') // PATCH /users/:id
    update(@Param('id', ParseIntPipe) id: number, @Body(ValidationPipe) updateUserDto: UpdateUserDto) {
        return this.usersService.update(id, updateUserDto)
    }
    @Delete(':id') // Delete /users/:id
    delete(@Param('id', ParseIntPipe) id: number) {
        return this.usersService.delete(id)
    }

}
