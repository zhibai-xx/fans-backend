# Fans Community Backend

一个基于 NestJS 的粉丝社区后端API服务，提供用户管理、媒体上传、内容管理等功能。

## 🚀 技术栈

- **框架**: NestJS
- **语言**: TypeScript
- **数据库**: PostgreSQL
- **ORM**: Prisma
- **认证**: JWT + Passport
- **文件上传**: Multer
- **云存储**: 阿里云OSS (可选)
- **API文档**: Swagger

## 📁 项目结构

```
src/
├── auth/                  # 认证模块
│   ├── controllers/       # 认证控制器
│   ├── services/          # 认证服务
│   ├── dto/              # 数据传输对象
│   └── guards/           # 认证守卫
├── media/                # 媒体模块
│   ├── dto/              # 媒体相关DTO
│   └── controllers/      # 媒体控制器
├── upload/               # 上传模块
│   ├── services/         # 上传服务
│   └── controllers/      # 上传控制器
├── database/             # 数据库模块
├── config/               # 配置文件
└── ...
```

## 🛠️ 开发环境设置

### 1. 安装依赖
```bash
npm install
```

### 2. 数据库设置
确保PostgreSQL已安装并运行，然后创建数据库：
```sql
CREATE DATABASE fans_db;
```

### 3. 环境变量配置
复制 `env.example` 为 `.env` 并填入正确的配置：
```bash
cp env.example .env
```

### 4. 数据库迁移
```bash
# 生成Prisma客户端
npx prisma generate

# 运行数据库迁移
npx prisma migrate dev

# (可选) 填充测试数据
npx prisma db seed
```

### 5. 启动开发服务器
```bash
npm run start:dev
```

API服务将在 [http://localhost:3000](http://localhost:3000) 启动。

## 📚 API文档

启动服务器后，访问 [http://localhost:3000/api](http://localhost:3000/api) 查看Swagger API文档。

## 🔧 主要功能

### 认证模块
- ✅ 用户注册/登录
- ✅ JWT token管理
- ✅ 密码加密
- ✅ 用户UUID系统

### 媒体模块
- ✅ 图片/视频上传
- ✅ 媒体列表查询
- ✅ 标签管理
- ✅ 分类管理
- ✅ 媒体状态管理

### 上传模块
- ✅ 多种存储方式 (本地/OSS)
- ✅ 文件类型验证
- ✅ 文件大小限制
- ✅ 缩略图生成

### 用户模块
- ✅ 用户资料管理
- ✅ 收藏功能
- ✅ 下载记录

## 🗄️ 数据库设计

项目使用Prisma ORM，主要数据模型包括：
- `User` - 用户表
- `Media` - 媒体表
- `Category` - 分类表
- `Tag` - 标签表
- `MediaTag` - 媒体标签关联表
- `Comment` - 评论表
- `Favorite` - 收藏表

## 🔒 安全特性

- JWT认证
- 密码加密 (bcrypt)
- 请求限流 (Throttler)
- 文件类型验证
- 输入数据验证
- CORS配置

## 🌐 API端点

### 认证相关
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/refresh` - 刷新token

### 媒体相关
- `GET /api/media/images` - 获取图片列表
- `GET /api/media/videos` - 获取视频列表
- `POST /api/media/upload` - 上传媒体文件
- `GET /api/media/tags` - 获取标签列表
- `GET /api/media/categories` - 获取分类列表

### 用户相关
- `GET /api/users/profile` - 获取用户资料
- `PUT /api/users/profile` - 更新用户资料
- `GET /api/users/favorites` - 获取收藏列表

## 📦 构建和部署

### 构建生产版本
```bash
npm run build
```

### 启动生产服务器
```bash
npm run start:prod
```

### Docker部署
```bash
# 构建镜像
docker build -t fans-backend .

# 运行容器
docker run -p 3000:3000 fans-backend
```

## 🧪 测试

```bash
# 单元测试
npm run test

# 端到端测试
npm run test:e2e

# 测试覆盖率
npm run test:cov
```

## 📋 环境变量说明

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `DATABASE_URL` | PostgreSQL连接字符串 | `postgresql://user:pass@localhost:5432/db` |
| `JWT_SECRET` | JWT密钥 | `your-secret-key` |
| `PORT` | 服务器端口 | `3000` |
| `OSS_ACCESS_KEY_ID` | 阿里云OSS访问密钥 | `your-access-key` |
| `USE_OSS_STORAGE` | 是否使用OSS存储 | `true/false` |

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest
