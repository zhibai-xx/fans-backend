import { CreateUserDto } from "./create-user.dto";
import { PartialType } from '@nestjs/mapped-types'

// 更新用户DTO继承自创建用户DTO，但所有字段都是可选的（通过PartialType实现）
export class UpdateUserDto extends PartialType(CreateUserDto) { }