npm instal

nest g module users

nest g controller users

nest g service users



1. npm i @nestjs/mapped-types -D
2. npm i class-validator class-transformer	// 装饰器，类型检查

- ValidationPipe放在@Body(ValidationPipe)里面用于类型检查
- 在dto文件，即类型文件里面启用，import { IsEmail, IsEnum, IsNotEmpty, IsString } from"class-validator";

3. npm i prisma -D	// 数据库相关依赖
   1. npx prisma init
