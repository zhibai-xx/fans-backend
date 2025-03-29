import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class EmployeesService {
  // 通过构造函数注入数据库服务
  constructor(private readonly databaseService: DatabaseService) { }
  
  // 创建新员工记录
  async create(createEmployeeDto: Prisma.EmployeeCreateInput) {
    // 使用Prisma客户端创建员工记录
    return this.databaseService.employee.create({
      data: createEmployeeDto
    })
  }

  // 查找所有员工，可以按角色筛选
  async findAll(role?: 'ADMIN' | 'ENGINEER' | 'INTERN') {
    // 如果指定了角色，按角色筛选
    if (role) return this.databaseService.employee.findMany({
      where: {
        role,
      }
    })
    // 否则返回所有员工
    return this.databaseService.employee.findMany()
  }

  // 查找特定ID的员工
  async findOne(id: number) {
    // 使用Prisma客户端查找唯一记录
    return this.databaseService.employee.findUnique({
      where: {
        id,
      }
    })
  }

  // 更新特定ID的员工信息
  async update(id: number, updateEmployeeDto: Prisma.EmployeeUpdateInput) {
    // 使用Prisma客户端更新员工记录
    return this.databaseService.employee.update({
      where: {
        id,
      },
      data: updateEmployeeDto
    })
  }

  // 删除特定ID的员工
  async remove(id: number) {
    // 使用Prisma客户端删除员工记录
    return this.databaseService.employee.delete({
      where: {
        id,
      }
    })
  }
}
