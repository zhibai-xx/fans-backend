# 生产环境变量填写清单

适用范围：

- 前端：`/Users/houjiawei/Desktop/Projects/zjy-fans/fans-next/.env.production`
- 后端：`/Users/houjiawei/Desktop/Projects/zjy-fans/fans-backend/.env.production`
- Compose：`/Users/houjiawei/Desktop/Projects/zjy-fans/deploy/compose/.env.prod`

目标：

- 备案通过当天，直接按此清单填写并上线
- 避免把占位值、开发地址、错误域名带到生产

当前推荐生产架构：

- 轻量应用服务器：`Nginx + fans-next + fans-backend + Redis`
- 数据库：阿里云 `RDS PostgreSQL`

## 一、前端 `.env.production`

必须替换：

- `NEXTAUTH_URL`
  - 填：`https://enjoycorner.com`
- `NEXTAUTH_SECRET`
  - 填：强随机字符串，建议 32 字节以上
- `NEXT_PUBLIC_API_URL`
  - 填：`https://enjoycorner.com/api`
- `NEXT_PUBLIC_SITE_URL`
  - 填：`https://enjoycorner.com`
- `BACKEND_INTERNAL_ORIGIN`
  - Compose 内部署填：`http://backend:3000`

保持当前值：

- `NEXT_PUBLIC_PRIMARY_TALENT_SLUG=joy-star`
- `NEXT_PUBLIC_ENABLE_VIDEO_FEATURE=false`

上线前检查：

- 不允许出现 `localhost`
- 不允许保留 `replace-` 占位文案

## 二、后端 `.env.production`

必须替换：

- `DATABASE_URL`
  - 当前推荐：使用阿里云 RDS PostgreSQL 的真实连接地址与真实账号密码
  - 示例：
    - `postgresql://idol_user:<强密码>@rm-xxxxxx.pg.rds.aliyuncs.com:5432/idol_db?schema=public`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `DOWNLOAD_SIGN_SECRET`
- `OSS_ACCESS_KEY_ID`
- `OSS_ACCESS_KEY_SECRET`
- `OSS_BUCKET`
- `OSS_ENDPOINT`
- `OSS_REGION`
- `OSS_CDN_BASE_URL`

建议值：

- `PORT=3000`
- `NODE_ENV=production`
- `JWT_ACCESS_EXPIRES_IN=15m`
- `JWT_REFRESH_EXPIRES_IN=30d`
- `CORS_ORIGINS=https://enjoycorner.com,https://www.enjoycorner.com`
- `REDIS_HOST=redis`
- `REDIS_PORT=6379`
- `REDIS_PASSWORD=`
- `REDIS_DB=0`
- `ENABLE_VIDEO_FEATURE=false`
- `TRUST_PROXY=true`
- `BODY_PARSER_DEBUG=false`
- `ENABLE_SWAGGER=false`
- `USE_OSS_STORAGE=true`

如果你上线初期仍临时使用本地存储：

- `USE_OSS_STORAGE=false`
- 保留：
  - `LOCAL_UPLOAD_DIR=./uploads`
  - `UPLOAD_DIR=./uploads`

上线前检查：

- 不允许出现 `localhost`
- 不允许出现 `replace-`
- 不允许出现 `your-oss-`
- `ENABLE_SWAGGER` 必须为 `false`

## 三、Compose `.env.prod`

仅在使用 Compose 内 PostgreSQL 时需要。

必须替换：

- `POSTGRES_PASSWORD`

建议值：

- `POSTGRES_DB=idol_db`
- `POSTGRES_USER=idol_user`

上线前检查：

- 不允许使用弱密码
- 如果当前使用 RDS，可以暂时不创建该文件

## 四、生成随机密钥建议

本地终端可直接生成：

```bash
openssl rand -base64 48
```

建议至少生成 4 个不同值：

- `NEXTAUTH_SECRET`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `DOWNLOAD_SIGN_SECRET`

## 五、上线当天最终核对

逐项确认：

- 没有把 `.env.production.example` 直接当成正式文件使用
- 所有 `replace-*` 占位值都已替换
- 所有域名都指向 `enjoycorner.com`
- 不再出现 `localhost`
- 视频开关仍为关闭
- Swagger 在生产默认关闭
