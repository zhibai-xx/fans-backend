# 生产部署 Runbook

适用范围：

- 前端：`/Users/houjiawei/Desktop/Projects/zjy-fans/fans-next`
- 后端：`/Users/houjiawei/Desktop/Projects/zjy-fans/fans-backend`
- 服务器：单台阿里云主机，Docker Compose 部署
- 域名：`enjoycorner.com`

当前推荐生产架构：

- 轻量应用服务器：`Nginx + fans-next + fans-backend + Redis`
- 数据库：阿里云 `RDS PostgreSQL`

## 备案通过前

### 1. 服务器准备

安装：

- Docker
- Docker Compose
- Git
- Nginx（如果使用宿主机 Nginx）

### 2. 复制生产环境模板

前端：

```bash
cd /path/to/fans-next
cp .env.production.example .env.production
```

后端：

```bash
cd /path/to/fans-backend
cp .env.production.example .env.production
```

Compose 级变量（仅本地 PostgreSQL 方案需要）：

```bash
cd /path/to/zjy-fans/deploy/compose
cp .env.prod.example .env.prod
```

### 3. 必填项

前端：

- `NEXTAUTH_SECRET`

后端：

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `DOWNLOAD_SIGN_SECRET`
- `OSS_ACCESS_KEY_ID`
- `OSS_ACCESS_KEY_SECRET`
- `OSS_BUCKET`
- `TRUST_PROXY=true`
- `BODY_PARSER_DEBUG=false`
- `ENABLE_SWAGGER=false`

Compose（仅本地 PostgreSQL 方案需要）：

- `POSTGRES_PASSWORD`

## 备案通过当天

### 1. 配置域名解析

- `enjoycorner.com`
- `www.enjoycorner.com`

均解析到 ECS 公网 IP。

### 2. 启动服务

如果使用阿里云 RDS PostgreSQL：

```bash
cd /path/to/zjy-fans
docker compose \
  -f deploy/compose/docker-compose.prod.rds.yml \
  up -d --build
```

如果使用 Compose 内 PostgreSQL：

```bash
cd /path/to/zjy-fans
docker compose \
  --env-file deploy/compose/.env.prod \
  -f deploy/compose/docker-compose.prod.yml \
  up -d --build
```

### 3. 执行数据库部署

```bash
docker exec -it fans-backend npx prisma migrate deploy
docker exec -it fans-backend npx prisma generate
```

### 4. 基础健康检查

```bash
curl -I http://127.0.0.1
curl http://127.0.0.1/api/health
```

预期：

- Nginx 返回 `200`
- `/api/health` 返回健康状态，数据库与 Redis 正常

### 5. HTTPS

先确认 HTTP 全链路正常，再接入证书与 HTTPS。

## 上线后第一轮回归

### 游客链路

- 首页
- 图片页
- 图片详情
- 下载

### 用户链路

- 登录
- 个人中心
- 点赞 / 收藏
- 会话失效处理

### 管理链路

- `/admin/dashboard`
- `/system-ingest`
- 图片上传 / 系统导入

## 上线后一周内

- 提交 `sitemap.xml` 到 Google Search Console / 百度搜索资源平台
- 打开数据库自动备份
- 检查 Redis 持久化
- 观察带宽、磁盘、容器日志与慢请求
