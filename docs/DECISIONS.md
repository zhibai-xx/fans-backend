# 2026-02-12 上线最小交付清单（后端）
- 决策：上线前先完成“低成本可发布”清单，不提前投入云资源
- 阶段一（本地完工标准）：
- `npm run lint`、`npm run typecheck`、`npm run test:integration` 全绿
- `.env.example` 完整且不含真实密钥
- 数据库迁移可重放（`prisma migrate deploy` 可执行）
- 阶段二（上云前采购）：
- 域名 1 个（主域名即可）
- 云主机 1 台（2C4G 起步）+ 托管 PostgreSQL（或同机自管）
- HTTPS 证书（Let's Encrypt 免费）
- 阶段三（部署落地）：
- Nginx 反代到后端 3000，限制来源并开启 gzip
- 生产环境变量：`JWT_*`、`CORS_ORIGINS`、`LOGIN_*`、`DATABASE_URL`
- 启动后先验证 `/api/health`、`/api/users/login`、`/api/users/refresh-token`
- 阶段四（可用性与回滚）：
- 开启免费 Uptime 探测 `/api/health`
- 准备回滚：保留上一个镜像/构建包 + 数据库备份点
- 影响：当前阶段不增加成本，先把工程质量与部署顺序固定

# 2026-02-12 登录防刷与失败锁定策略
- 决策：在 `/api/users/login` 前置执行登录安全检查，减少暴力破解与撞库风险
- 规则：
- IP 频率限制：`LOGIN_RATE_LIMIT_WINDOW_SECONDS` 时间窗内，IP 总尝试数超过 `LOGIN_RATE_LIMIT_MAX_IP_ATTEMPTS` 直接拒绝
- IP 失败锁定：`LOGIN_LOCK_WINDOW_SECONDS` 时间窗内，IP 失败数超过 `LOGIN_LOCK_MAX_FAILURES_IP` 直接拒绝
- 账户失败锁定：同时间窗内，已存在账户失败数超过 `LOGIN_LOCK_MAX_FAILURES_USERNAME` 直接拒绝
- 拒绝行为：
- 返回 HTTP 429（`登录尝试过于频繁，请稍后再试`）
- 记录 `LoginLog.result=BLOCKED`，便于审计和告警
- 默认值：
- 频率窗口 15 分钟 / IP 总尝试 30 次
- 锁定窗口 10 分钟 / IP 失败 8 次 / 账户失败 5 次 / 锁定 15 分钟
- 影响：
- 可能在高并发共享出口网络下触发误封，生产环境需按流量特征调整阈值
- 当前策略基于数据库日志计数，后续可升级 Redis 计数以降低 DB 压力

# 2026-02-12 双 Token 会话策略
- 决策：后端认证改为双 token（短生命周期 access token + 长生命周期 refresh token）
- 变更点：
- `POST /api/users/login` 返回 `access_token`、`refresh_token`、`user`
- 新增 `POST /api/users/refresh-token`，入参 `refresh_token`，返回新的 token 对
- access token 过期时间由 `JWT_ACCESS_EXPIRES_IN` 控制（默认 15m）
- refresh token 过期时间由 `JWT_REFRESH_EXPIRES_IN` 控制（默认 30d）
- refresh token 使用独立密钥 `JWT_REFRESH_SECRET`（生产环境强制配置）
- 登录成功后提升 `session_version`，实现“新端登录挤下旧端”
- access token/refresh token 均携带 `sessionVersion`，服务端校验不一致即判定会话失效
- 新增 `/api/users/logout`，通过提升 `session_version` 主动使当前 token 失效
- 约束：
- 生产环境禁止占位 `JWT_SECRET`/`JWT_REFRESH_SECRET`
- 当前版本实现的是“单会话优先”策略（新登录挤下旧登录）；设备级多会话白名单与细粒度黑名单后续补齐
- 影响：
- 前端 NextAuth 需保存 refresh token 并在 access token 临近过期时自动换发
- 接口契约已变化，调用端需兼容新响应字段

# 2025-11-10 系统导入来源统一策略
- 将 MediaSource 枚举精简为 USER_UPLOAD/SYSTEM_INGEST/ADMIN_UPLOAD/EXTERNAL_FEED，统一解释各种脚本、Playwright、API 归属系统导入
- 所有后端接口与日志去除微博字段，系统导入的 API 统一使用 `/upload/system-ingest/*`，source_metadata 以 ingestUserId/sourcePipeline 等泛化字段描述
- 前后端约定：系统导入上传服务仅接受对象化的 selectedFiles（包含 path/name/userId），避免出现敏感字样并便于后续扩展
