import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class UsersService {
    // 通过构造函数注入数据库服务
    constructor(private readonly databaseService: DatabaseService) { }

    /**
     * 查找所有用户，可以按角色筛选
     * @param role 可选的角色筛选参数
     * @returns 筛选后的用户数组
     */
    async findAll(role?: UserRole) {
        if (role) return this.databaseService.user.findMany({
            where: {
                role,
            }
        })
        return this.databaseService.user.findMany()
    }

    /**
     * 查找特定ID的用户
     * @param id 用户ID
     * @returns 找到的用户对象
     */
    async findOne(id: number) {
        const user = this.databaseService.user.findUnique({
            where: {
                id,
            },
        })
        // 如果没有找到用户，抛出NotFoundException异常
        if (!user) throw new NotFoundException('User Not Found')
        return user
    }

    /**
     * 创建新用户
     * @param createUserDto 创建用户的数据传输对象
     * @returns 创建后的用户对象
     */
    async create(createUserDto: CreateUserDto) {
        return this.databaseService.user.create({
            data: createUserDto
        })
    }

    /**
     * 更新特定ID的用户
     * @param id 用户ID
     * @param updateUserDto 更新用户的数据传输对象
     * @returns 更新后的用户对象
     */
    async update(id: number, updateUserDto: UpdateUserDto) {
        return this.databaseService.user.update({
            where: {
                id,
            },
            data: updateUserDto
        })
    }

    /**
     * 删除特定ID的用户
     * @param id 用户ID
     * @returns 被删除的用户对象
     */
    async delete(id: number) {
        return this.databaseService.user.delete({
            where: {
                id
            }
        })
    }
}
