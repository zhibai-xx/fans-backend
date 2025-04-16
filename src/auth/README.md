# 认证 (Auth) 模块

本模块实现了基于 JWT (JSON Web Token) 的用户认证系统，支持用户注册、登录、获取和更新用户资料等功能。

## 目录结构

```
src/auth/
├── controllers/         # 控制器
│   └── user.controller.ts  # 用户相关API接口
├── dto/                 # 数据传输对象
│   ├── login.dto.ts        # 登录请求数据结构
│   ├── register.dto.ts     # 注册请求数据结构
│   └── update-user.dto.ts  # 更新用户信息请求数据结构
├── guards/              # 守卫
│   └── jwt-auth.guard.ts   # JWT认证守卫
├── services/            # 服务
│   ├── auth.service.ts     # 认证服务
│   └── user.service.ts     # 用户服务
├── strategies/          # 策略
│   └── jwt.strategy.ts     # JWT验证策略
└── auth.module.ts       # 认证模块配置
```

## 核心功能

### 1. 用户注册

- 路径: `POST /users/register`
- 服务: `UserService.register()`
- 功能: 
  - 验证用户名和邮箱是否已存在
  - 对密码进行加密处理
  - 在数据库中创建新用户
  - 返回登录令牌

### 2. 用户登录

- 路径: `POST /users/login`
- 服务: `UserService.login()` 和 `AuthService.login()`
- 功能:
  - 验证用户名和密码
  - 生成JWT令牌
  - 返回用户信息和令牌

### 3. 获取用户信息

- 路径: `GET /users/profile` 和 `GET /users/:id`
- 守卫: `JwtAuthGuard`
- 功能:
  - 获取当前登录用户或指定ID用户的信息
  - 需要有效的JWT令牌才能访问

### 4. 更新用户信息

- 路径: `PUT /users/profile`
- 守卫: `JwtAuthGuard`
- 功能:
  - 更新当前登录用户的信息
  - 验证邮箱和用户名的唯一性
  - 需要有效的JWT令牌才能访问

## 技术实现细节

### 密码加密

我们使用 [bcrypt](https://github.com/kelektiv/node.bcrypt.js) 库进行密码加密，确保数据库中不存储明文密码：

```typescript
// 注册时加密密码
const hashedPassword = await bcrypt.hash(password, 10);

// 登录时验证密码
const isPasswordValid = await bcrypt.compare(password, user.password);
```

- `bcrypt.hash` 方法中的第二个参数 `10` 表示"盐"的复杂度，这个值越高，生成的哈希越安全，但计算时间也越长
- bcrypt 自动处理"盐"的生成和存储，不需要单独的盐字段
- 密码比对使用 `bcrypt.compare`，即使哈希结果看起来相同，也应该使用这个方法而非直接比较

### JWT 身份验证

JWT (JSON Web Token) 用于保护需要认证的路由，实现方式如下:

1. **令牌生成** (AuthService):
   ```typescript
   const payload = { username: user.username, sub: user.id };
   return this.jwtService.sign(payload);
   ```
   - `sub` 是JWT标准中用于标识主体的字段
   - 我们将用户ID存储在此字段中

2. **令牌验证** (JwtStrategy):
   ```typescript
   async validate(payload: any) {
     const user = await this.userService.findById(parseInt(payload.sub));
     if (!user) {
       throw new UnauthorizedException('用户不存在');
     }
     return user;
   }
   ```
   - 从令牌中提取用户ID
   - 通过ID查找用户
   - 将用户信息注入到请求对象中

3. **路由保护** (JwtAuthGuard):
   ```typescript
   @UseGuards(JwtAuthGuard)
   async getProfile(@Request() req) {
     return this.userService.findById(req.user.id);
   }
   ```
   - `@UseGuards(JwtAuthGuard)` 装饰器用于保护需要认证的路由
   - 经过验证的用户信息可以从 `req.user` 中获取

### 数据验证

我们使用 `class-validator` 实现请求数据验证，例如:

```typescript
export class RegisterDto {
  @IsNotEmpty({ message: '用户名不能为空' })
  @IsString({ message: '用户名必须是字符串' })
  @MinLength(3, { message: '用户名长度不能少于3个字符' })
  @MaxLength(20, { message: '用户名长度不能超过20个字符' })
  username: string;

  @IsNotEmpty({ message: '邮箱不能为空' })
  @IsEmail({}, { message: '邮箱格式不正确' })
  email: string;

  @IsNotEmpty({ message: '密码不能为空' })
  @IsString({ message: '密码必须是字符串' })
  @MinLength(6, { message: '密码长度不能少于6个字符' })
  password: string;
}
```

这些验证规则会在请求处理前自动检查，如果数据不符合要求，会返回相应的错误信息。

### 错误处理

我们使用 NestJS 的内置异常类处理各种错误情况:

```typescript
// 用户不存在
throw new NotFoundException('用户不存在');

// 密码错误
throw new UnauthorizedException('密码错误');

// 用户名或邮箱已存在
throw new ConflictException('用户名或邮箱已被注册');
```

这样可以确保返回一致的错误格式和HTTP状态码。

## 与数据库的集成

本模块使用 Prisma ORM 管理数据库交互，而不是直接操作数据库：

```typescript
// 创建用户
const user = await this.databaseService.user.create({
  data: {
    username,
    email,
    password: hashedPassword,
  }
});

// 查找用户
const user = await this.databaseService.user.findUnique({ 
  where: { username } 
});
```

这样做的好处是:
- 类型安全的数据库操作
- 自动的SQL注入防护
- 更简洁的查询代码

## 安全建议

1. 在生产环境中，请确保:
   - 使用安全的随机生成字符串作为 JWT 密钥
   - 设置合理的令牌过期时间
   - 配置HTTPS，避免令牌在传输过程中被窃取

2. 考虑添加:
   - 刷新令牌机制
   - 令牌撤销功能
   - 双因素认证
   - 登录尝试次数限制

## 使用示例

### 注册新用户

```bash
curl -X POST http://localhost:3000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"username": "newuser", "email": "user@example.com", "password": "password123"}'
```

### 用户登录

```bash
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"username": "newuser", "password": "password123"}'
```

### 获取用户信息

```bash
curl -X GET http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 更新用户信息

```bash
curl -X PUT http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "newemail@example.com"}'
``` 