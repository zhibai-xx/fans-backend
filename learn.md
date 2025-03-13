npm instal ***

nest g module users

nest g controller users

nest g service users

1. npm i @nestjs/mapped-types -D
2. npm i class-validator class-transformer	// 装饰器，类型检查

- ValidationPipe放在@Body(ValidationPipe)里面用于类型检查
- 在dto文件，即类型文件里面启用，import { IsEmail, IsEnum, IsNotEmpty, IsString } from"class-validator";

## 数据库Prisma

npm i prisma -D	// Prisma 是一个现代化的 **数据库工具包**

1. npx prisma init
2. npx prisma migrate dev --name init // 迁移到**云数据库**
3. npx prisma generate // 修改数据库文件schema.prisma之后，**执行更改**
4. npx prisma migrate dev --name name_change // 执行更改之后，再次迁移

## 创建数据库模型

nest g module database

nest g service database

nest g resource employees	// 创建REST api
