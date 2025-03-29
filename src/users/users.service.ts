import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { NotFoundException } from '@nestjs/common';

@Injectable()
export class UsersService {
    // 模拟用户数据，实际应用中通常会从数据库获取
    private users = [
        {
            "id": 1,
            "name": '11',
            "email": '1@qq.com',
            "role": 'INTERN'
        }, {
            "id": 2,
            "name": '22',
            "email": '2@qq.com',
            "role": 'ADMIN'
        }, {
            "id": 3,
            "name": '33',
            "email": '3@qq.com',
            "role": 'INTERN'
        }, {
            "id": 4,
            "name": '44',
            "email": '4@qq.com',
            "role": 'ENGINEER'
        }
    ]

    /**
     * 查找所有用户，可以按角色筛选
     * @param role 可选的角色筛选参数
     * @returns 筛选后的用户数组
     */
    findAll(role?: 'ADMIN' | 'INTERN' | 'ENGINEER') {
        if (role) {
            const rolesArray = this.users.filter(user => user.role === role)
            // 如果没有找到匹配的角色，抛出NotFoundException异常
            if (rolesArray.length === 0) throw new NotFoundException('User Role Not Found')
            return rolesArray
        }
        return this.users
    }

    /**
     * 查找特定ID的用户
     * @param id 用户ID
     * @returns 找到的用户对象
     */
    findOne(id: number) {
        const user = this.users.find(user => user.id === id)
        // 如果没有找到用户，抛出NotFoundException异常
        if (!user) throw new NotFoundException('User Not Found')
        return user
    }

    /**
     * 创建新用户
     * @param createUserDto 创建用户的数据传输对象
     * @returns 创建后的用户对象
     */
    create(createUserDto: CreateUserDto) {
        // 按ID降序排序，找出最大ID
        const usersByHighestId = [...this.users].sort((a, b) => b.id - a.id)
        // 创建新用户，ID为最大ID+1
        const newUser = {
            id: usersByHighestId[0].id + 1,
            ...createUserDto
        }
        this.users.push(newUser)
        return newUser
    }

    /**
     * 更新特定ID的用户
     * @param id 用户ID
     * @param updateUserDto 更新用户的数据传输对象
     * @returns 更新后的用户对象
     */
    update(id: number, updateUserDto: UpdateUserDto) {
        // 遍历用户数组，更新指定ID的用户
        this.users = this.users.map(user => {
            if (user.id === id) {
                return { ...user, ...updateUserDto }
            }
            return user
        })
        return this.findOne(id)
    }

    /**
     * 删除特定ID的用户
     * @param id 用户ID
     * @returns 被删除的用户对象
     */
    delete(id: number) {
        const removeUser = this.findOne(id)
        // 从用户数组中移除指定ID的用户
        this.users = this.users.filter(user => user.id !== id)
        return removeUser
    }
}
