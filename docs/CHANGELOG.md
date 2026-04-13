# 2026-04-13
- 部署链路收口：将 `deploy/` 迁入 `fans-backend` 仓库，避免服务器部署时还要额外同步根目录部署文件
- 修正后端 `.gitignore` 中 `logs` 误伤 `src/logs` 源码目录的问题，CI 不再因缺失日志模块源码而出现 `TS2307`
- 新增 `scripts/repro-ci-lint.sh` 与 `npm run lint:ci:repro`，可在本地用 `node:20` 容器复现 GitHub Actions 的 typed lint 环境
- 视频处理运行时改为优先使用系统 `ffmpeg` / `ffprobe`，不再依赖 `ffmpeg-static` / `ffprobe-static` 在 `npm ci` 阶段下载二进制
- 后端运行镜像在 runner 阶段通过 `apk add --no-cache ffmpeg` 提供 ffmpeg，降低国内服务器首次构建失败风险
- 接口契约变更：否

# 2026-03-31
- 健康检查 `/api/health` 显式跳过 `short/medium/long` 全局限流桶，避免探活与性能 smoke 被 `429` 误伤
- 收紧本地文件访问：`/api/upload/file/:type/:filename` 禁止访问 `temp`/`chunks` 上传中转目录
- 删除后端旧 `test/` 脚手架并将 `test:e2e` 对齐为当前真实集成测试集，避免上线前继续跑到失效用例
- 生产环境默认关闭 Swagger 文档暴露，仅在开发或显式设置 `ENABLE_SWAGGER=true` 时于 `/api/docs` 启用
- 新增 `docs/PRODUCTION_ENV_CHECKLIST.md`，集中整理前后端与 Compose 生产环境变量填写要求与上线核对项
- 生产部署材料进一步收口：`deploy/compose/docker-compose.prod.yml` 强制要求前后端 `.env.production` 存在，避免缺环境变量时误启动
- 新增 Compose 级环境模板 `deploy/compose/.env.prod.example`，集中管理 PostgreSQL 初始化参数
- Nginx 生产模板 `deploy/nginx/fans.conf` 默认对齐 `enjoycorner.com / www.enjoycorner.com`
- 新增部署运行手册 `docs/DEPLOY_RUNBOOK.md`，覆盖备案通过前准备、备案通过当天启动步骤与上线后第一轮回归
- 接口契约变更：否

# 2026-03-17
- 上线前部署收口：新增后端 `Dockerfile` 与 `.dockerignore`，可直接构建生产镜像并通过 `npm run start:prod` 以 `3000` 端口启动
- 生产代理适配：Nest 启动时在 `TRUST_PROXY=true` 或生产环境下启用 `trust proxy`，确保后续挂在 Nginx/CDN 后能正确获取真实来源链路
- body parser 调试日志改为 `BODY_PARSER_DEBUG` 显式开关，默认不再在运行时打印原始请求头，避免生产环境日志泄露与噪音
- 新增后端视频功能开关 `ENABLE_VIDEO_FEATURE=false`，首发阶段默认关闭视频上传、系统导入视频文件与视频处理控制器入口
- 上传链路统一拒绝视频：`/upload/init`、分片合并与 system-ingest 初始化在视频关闭时返回明确错误，避免前端隐藏后仍可从接口写入视频数据
- 媒体层与视频处理层同步封口：`MediaService.create` 不再接受 `VIDEO` 媒体创建，`/video-processing/*` 在视频关闭时直接返回业务错误
- 主要改动文件：`Dockerfile`、`.dockerignore`、`src/main.ts`、`src/config/env.validation.ts`、`.env.example`、`src/upload/upload.service.ts`、`src/media/media.service.ts`、`src/video-processing/controllers/video-processing.controller.ts`
- 接口契约变更：是（视频关闭时相关入口返回 400，并附带明确提示文案）

# 2026-02-28
- 下载链路升级为“游客可下载 + Redis 限流 + 短时签名链接”：`POST /api/media/:mediaId/download` 改为可选登录（登录用户记录下载，游客走 Redis 限流），新增 `GET /api/media/:mediaId/download/signed` 校验签名后重定向真实文件地址
- 新增 `GuestDownloadRateLimitService`，将游客下载限流从进程内 `Map` 迁移到 Redis（每小时上限 + 最短间隔），为多实例部署保持一致性
- 补充 Redis 与下载签名环境变量键位：`REDIS_HOST/REDIS_PORT/REDIS_PASSWORD/REDIS_DB/DOWNLOAD_SIGN_SECRET`
- 主要改动文件：`src/media/controllers/media-download.controller.ts`、`src/media/services/guest-download-rate-limit.service.ts`、`src/media/media.module.ts`、`.env.example`
- 接口契约变更：是（下载接口返回 `download_url` 由直接文件地址改为短时签名地址）

# 2026-02-12
- 修复自定义 body parser 运行时异常：`main.ts` 改为 `import express from 'express'`，确保 `express.json`/`express.urlencoded` 在运行时可调用，消除 `Cannot read properties of undefined (reading 'json')`
- JWT 与 CORS 安全基线加固：新增 `security.config`，强制校验 `JWT_SECRET` 不可为空/占位值；CORS 改为读取 `CORS_ORIGINS`（生产环境必填，开发环境回退本地 3001）
- 同步更新 `.env.example` 与 `env.example` 的 `JWT_SECRET`、`CORS_ORIGINS` 配置示例
- 新增 refresh token 认证链路：`POST /api/users/login` 现返回 `access_token + refresh_token`，并新增 `POST /api/users/refresh-token` 用于换发 token 对
- JWT 生命周期改为环境化：`JWT_ACCESS_EXPIRES_IN`（默认 15m）与 `JWT_REFRESH_EXPIRES_IN`（默认 30d）；`JWT_REFRESH_SECRET` 在生产环境强制配置
- 新增会话失效控制：`User.session_version` 字段 + JWT 版本校验，登录会提升版本并使旧端 access/refresh token 失效；新增 `POST /api/users/logout` 主动失效当前会话
- 新增认证流程回归测试：覆盖登录→刷新→异地登录挤下线→登出失效，补充 refresh/logout 契约检查，确保会话策略可回归验证
- 新增 HTTP 层认证 e2e（Nest app + supertest）：默认在受限环境跳过，设置 `ALLOW_SOCKET_TESTS=true` 可启用执行
- 登录安全增强：`/api/users/login` 增加前置防刷检查（IP 频率限制 + IP/账户失败次数锁定），命中后返回 429 并记录 `BLOCKED` 登录日志
- 新增登录防刷单测 `tests/unit/auth/login-guard.spec.ts`，覆盖“IP 频率超限/账户失败超限/正常放行”
- 新增登录限流集成测试 `tests/integration/auth/login-rate-limit.spec.ts`，验证命中限制时抛出 429 且写入 `BLOCKED` 登录日志
- 安全基线新增生产参数与告警阈值建议：补充 `LOGIN_*` 推荐值、`BLOCKED`/失败率/refresh 失败率阈值，以及分阶段调参策略
- 新增低成本健康探针：后端提供 `/api/health`（服务状态、数据库连通、uptime），并补充对应单测 `tests/unit/app/health.spec.ts`
# 2026-03-16
- `system-ingest` 真实目录联调通过：已验证 `/Users/houjiawei/Desktop/Projects/Scripts/weibo-crawler/weibo` 的扫描、预览、图片导入与 `live_photo` 视频导入链路
- 系统导入元数据识别增强：中文目录 `原创/原图` 与 `live_photo` 现在会正确映射为 `original/live` 分类，新增媒体标题不再误标为 `general`
- 新增后端压测/安全 smoke 脚本：`tests/performance/public-endpoints.smoke.cjs`、`tests/performance/system-ingest-scan.smoke.cjs`、`tests/security/auth-download.smoke.cjs`
- 新增并发导入与 Redis 故障演练脚本：`tests/performance/system-ingest-concurrency.smoke.cjs`、`tests/resilience/redis-download-failure.smoke.cjs`
- 新增真实分片上传并发 smoke：`tests/performance/upload-chunk-concurrency.smoke.cjs`，已验证 2 个图片文件并发 init/chunk/merge 可成功完成
- 游客下载限流改为 Redis 故障快速失败：Redis 不可用时下载接口返回 `503`，不再出现请求长时间挂起；`/api/health` 现同时检查 database 与 redis
- OSS 存储服务改为懒初始化：`USE_OSS_STORAGE=false` 时不再因为未配置真实 OSS 凭证导致应用启动失败
- 新增存储 readiness 检查：`tests/readiness/storage-mode.smoke.cjs`，当前本地环境会明确标记为 local 模式，提示 OSS/CDN 真实链路需在启用 OSS 后再验
- 后端验证通过：`npm run typecheck`、`ALLOW_SOCKET_TESTS=true npm run test:integration`、`npm run test:perf:baseline`、`npm run test:perf:ingest-scan`、`npm run test:security:smoke`

- 修复环境变量加载时机问题：`ConfigModule` 支持 `.env.local` 优先，`JwtModule` 改为 `registerAsync` 避免模块初始化阶段提前读取 `JWT_SECRET` 导致启动报错
- 环境模板统一：移除重复 `env.example`，仅保留 `.env.example`；README 改为 `cp .env.example .env`，并清理模板中的真实密钥为占位值
- 新增“上线最小交付清单（后端）”决策，明确本地达标、采购、部署、回滚四阶段步骤，降低前期上云试错成本
- 涉及文件：`src/main.ts`、`src/config/security.config.ts`、`src/auth/auth.module.ts`、`src/auth/strategies/jwt.strategy.ts`、`src/auth/services/auth.service.ts`、`src/auth/services/user.service.ts`、`src/auth/controllers/user.controller.ts`、`src/auth/dto/refresh-token.dto.ts`、`src/logs/services/login-log.service.ts`、`prisma/schema.prisma`、`prisma/migrations/20260212191000_add_user_session_version/migration.sql`、`tests/jest.unit.config.js`、`tests/jest.integration.config.js`、`tests/unit/auth/jwt-auth.spec.ts`、`tests/unit/auth/login-guard.spec.ts`、`tests/integration/auth/session-contract.spec.ts`、`tests/integration/auth/session-flow.spec.ts`、`tests/integration/auth/auth-http.e2e.spec.ts`、`.env.example`、`env.example`
- 接口契约变更：是（登录响应新增 `refresh_token`，新增 `/api/users/refresh-token`、`/api/users/logout`）

# 2025-11-12
- 媒体回收站定时任务改为调用 `cleanupRecycleBin`：BullMQ worker 会先清理到期的拒稿文件，再执行硬删除，确保 30 天后无需人工介入也能释放存储

# 2025-11-11
- `/media` 列表新增 `sourceGroup` 查询参数，支持按 MediaSource 聚合筛选官方精选（系统/管理员/外部）与社区投稿（用户上传）
- 扩展 `MediaStatus` 枚举（PENDING_REVIEW/APPROVED/REJECTED/USER_DELETED/ADMIN_DELETED/SYSTEM_HIDDEN）并新增 `deleted_by_type/deleted_by_id` 字段，软删记录会记录来源且默认进入延迟清理
- `/user-uploads` 增强：支持待审核内容的编辑/撤回、被拒绝内容重新提交、以及对待审核/被拒绝/已发布媒体的用户发起删除（标记为 USER_DELETED，前台自动隐藏并记录原因）
- 待审核稿件的撤回改为物理删除（仅保留后台日志），避免误入“已删除”列表；管理员恢复作者删除的作品会同步恢复到删除前的原始状态并移除快照标记

# 2025-11-10
- 调整媒体来源枚举：保留 USER_UPLOAD，并新增 SYSTEM_INGEST/ADMIN_UPLOAD/EXTERNAL_FEED 以覆盖系统导入与外部渠道
- 上传服务与控制器全面改造为系统导入语义，API 路径切换至 `/upload/system-ingest/*`，日志与提示去除微博字样
- 系统导入服务支持新的元数据结构（ingestUserId/sourcePipeline），并保持批量上传请求的对象化参数
- 新增 `20251110000100_update_media_source_enum` 迁移，确保数据库枚举与最新来源值同步
- initUpload/MediaService 依据用户角色或系统导入上下文写入 `source` 字段，管理员/自动导入不再记录为 USER_UPLOAD

# 2025-11-09
- 修复用户头像上传：上传目录跟随 `UPLOAD_DIR`，补充异常兜底并确保 Sharp 写入失败不会导致 500
- 返回用户信息时过滤默认占位头像 URL，保持老数据也能走前端的文字头像逻辑
- 头像多次上传命名加入时间戳，避免浏览器命中强缓存导致个人中心仍显示旧头像
- 调整 processed 物理目录至 `uploads/processed`，新增启动级迁移与统一路径工具，静态服务仍保持 `/processed/*` 前缀以兼容现有 URL
- 硬删逻辑补充 download_record / recycle_log 清理，彻底删除回收站记录时不再受外键影响
- 修复媒体 URL 归一化：`uploads/processed/*` 统一映射为 `/processed/*`，后台内容管理页视频可正常加载

# 2025-11-08
- 用户头像改造：新增 `POST /users/profile/avatar`（JWT 保护），使用内存上传+Sharp 裁剪压缩并统一 `/uploads/avatars` 默认文件
- 资料更新接口移除自定义 avatar 字段，避免绕过上传流程，所有头像改动均走新端点

# 2025-11-07
- 新增媒体留言控制器与服务，实现留言分页查询与发布接口
- 定义评论 DTO 的回复预览与分页结构，响应统一为 success/data/pagination
- 增加 `POST /media/:mediaId/view` 接口，统一处理前端观看次数上报；引入 30 分钟会话去重策略（用户/匿名 session/IP）
- 取消 `GET /media/:id` 自动增加浏览，改由播放/详情触发的 `/media/:mediaId/view` 负责计数
- 新增下载记录模型与接口：`POST /media/:mediaId/download` 记录下载并返回真实地址，`GET /user/downloads` 提供个人下载历史
