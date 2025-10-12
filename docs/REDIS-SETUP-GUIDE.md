# Redis 安装和启动指南 🚀

## 🎯 什么是 Redis？
Redis 是一个内存数据库，我们用它来存储视频处理任务队列。没有 Redis，视频处理功能无法工作。

## 📥 安装 Redis

### macOS 用户（推荐 Homebrew）

#### 1. 安装 Homebrew（如果没有）
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

#### 2. 安装 Redis
```bash
brew install redis
```

#### 3. 启动 Redis（两种方式）

**方式一：临时启动（关闭终端后停止）**
```bash
redis-server
```

**方式二：系统服务启动（推荐，开机自启）**
```bash
# 启动服务
brew services start redis

# 查看服务状态
brew services list | grep redis

# 停止服务
brew services stop redis
```

### Windows 用户

#### 1. 下载 Redis
访问：https://github.com/microsoftarchive/redis/releases
下载最新的 `.msi` 文件并安装

#### 2. 启动 Redis
```cmd
redis-server
```

### Linux 用户（Ubuntu/Debian）

```bash
# 安装
sudo apt update
sudo apt install redis-server

# 启动服务
sudo systemctl start redis-server
sudo systemctl enable redis-server

# 查看状态
sudo systemctl status redis-server
```

## ✅ 验证 Redis 是否正常运行

### 检查方法1：ping 测试
```bash
redis-cli ping
```
**预期返回**：`PONG`

### 检查方法2：查看进程
```bash
# macOS/Linux
ps aux | grep redis

# Windows
tasklist | findstr redis
```

### 检查方法3：查看端口
```bash
# macOS/Linux
lsof -i :6379

# Windows
netstat -ano | findstr :6379
```

## 🚀 项目启动顺序

### 完整启动流程：

#### 1. 启动 Redis
```bash
# 如果是服务方式（推荐）
brew services start redis

# 或者临时启动
redis-server
```

#### 2. 启动后端
```bash
cd fans-backend
npm run start:dev
```

#### 3. 启动前端
```bash
cd fans-next  
npm run dev
```

## 🔧 Redis 配置

### 默认配置
- **端口**：6379
- **主机**：localhost
- **密码**：无（开发环境）

### 如需自定义配置
在 `.env` 文件中添加：
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

## 🐛 常见问题解决

### 问题1：redis-server 命令找不到
**解决**：
```bash
# 确认 Redis 已正确安装
brew list | grep redis

# 重新安装
brew reinstall redis
```

### 问题2：端口 6379 被占用
**解决**：
```bash
# 查看占用进程
lsof -i :6379

# 杀死占用进程
kill -9 <进程ID>
```

### 问题3：权限问题
**解决**：
```bash
# 修改 Redis 数据目录权限
sudo chown $(whoami) /usr/local/var/db/redis/
```

## 📊 Redis 监控（可选）

### 实时监控命令
```bash
# 监控所有 Redis 命令
redis-cli monitor

# 查看 Redis 信息
redis-cli info

# 查看内存使用
redis-cli info memory
```

### Redis GUI 工具（可选）
- **RedisInsight**：官方可视化工具
- **Another Redis Desktop Manager**：开源桌面工具

## 🎉 测试是否正常工作

### 1. 启动所有服务
```bash
# 终端1：启动 Redis
redis-server

# 终端2：启动后端
cd fans-backend && npm run start:dev

# 终端3：启动前端
cd fans-next && npm run dev
```

### 2. 测试视频上传
访问 `http://localhost:3000`，尝试上传视频文件

### 3. 查看队列状态
```bash
redis-cli
> KEYS "*"  # 查看所有键
> LLEN bull:video-processing:waiting  # 查看等待队列长度
```

---

**记住**：Redis 必须先启动，否则视频处理功能无法工作！

