# 安全基线

## 认证与授权
- 使用 JWT + Passport 完成认证, token 设置合理过期时间与刷新机制
- 登录接口固定为 /api/users/login, 返回用户对象需包含 id 与 uuid
- 服务层执行权限与角色校验, 禁止在控制器内绕过授权逻辑
- 会话失效采用 `session_version` 机制: 新登录会使旧会话令牌失效, 登出会主动提升版本并失效当前令牌

## 登录防刷与锁定参数（生产建议）
- 以下参数均可通过环境变量覆盖，默认值用于中小流量站点

| 参数 | 默认值 | 生产建议起始值 | 说明 |
| --- | --- | --- | --- |
| `LOGIN_RATE_LIMIT_WINDOW_SECONDS` | `900` | `900` | 统计 IP 总尝试时间窗（秒） |
| `LOGIN_RATE_LIMIT_MAX_IP_ATTEMPTS` | `30` | `40` | 单 IP 时间窗内最大总尝试次数 |
| `LOGIN_LOCK_WINDOW_SECONDS` | `600` | `600` | 统计失败次数时间窗（秒） |
| `LOGIN_LOCK_MAX_FAILURES_IP` | `8` | `10` | 单 IP 时间窗内失败上限 |
| `LOGIN_LOCK_MAX_FAILURES_USERNAME` | `5` | `6` | 单账号时间窗内失败上限 |
| `LOGIN_LOCK_DURATION_SECONDS` | `900` | `900` | 命中锁定后的建议冷却时间（秒） |

## 告警阈值建议（首版）
- 指标一：`BLOCKED` 登录数（5 分钟窗口）
- 告警：`>= 30` 触发 warning，`>= 80` 触发 critical
- 指标二：登录失败率（10 分钟窗口）
- 告警：失败率 `>= 35%` 且总尝试 `>= 50` 触发 warning
- 指标三：同一账号失败峰值（10 分钟窗口）
- 告警：单账号失败 `>= 12` 触发 warning，建议自动风控观察
- 指标四：refresh token 失败率（10 分钟窗口）
- 告警：失败率 `>= 10%` 且请求数 `>= 30` 触发 warning

## 上线后调参策略
- 第一阶段（上线后 3 天）：以“不过度误封”为优先，先观察 `BLOCKED`/失败率分布，不立即收紧阈值
- 第二阶段（第 4-14 天）：根据来源 IP 分布、真实攻击样本调整 `MAX_IP_ATTEMPTS` 与 `MAX_FAILURES_*`
- 第三阶段（稳定期）：将阈值固化到环境变量模板，并纳入发布检查清单

## 输入验证
- 所有请求通过 DTO + class-validator 校验
- 分片上传校验文件类型、大小 (≤50MB) 与分片顺序
- 验证错误由统一过滤器输出字符串 message, 多条错误用分号连接

## CORS 与会话安全
- 配置允许的 Origin、方法与头部, 禁止通配放开
- 启用 HTTPS, 传输中避免敏感信息明文暴露
- 对跨域请求限制凭证字段, 防止 CSRF

## 日志与监控
- 使用自定义日志服务, 记录时间、路径、状态码等关键信息
- 对 token、密码、身份证号等敏感字段脱敏或省略
- 建立上传、认证、数据库错误的告警阈值
- 小站低成本监控基线：
- 后端提供公开 `/health` 健康探针（数据库连通 + 服务 uptime）
- 使用免费 Uptime 服务（如 UptimeRobot/Better Stack Free）每 1 分钟探测 `/api/health`
- 首阶段以“可用性报警 + 认证告警阈值”为主，不强制引入付费 APM

## 数据与存储
- 数据库连接凭证使用环境变量管理, 不写入代码库
- 密码使用强哈希算法 (如 bcrypt) 并加盐
- Prisma 操作敏感数据前后记录审计日志

## 上传安全
- Multer 配置临时目录权限, 定期清理
- 验证 multipart/form-data, 拒绝错误的 Content-Type
- 合并分片时校验顺序、哈希与大小, 防止篡改

## 与 .cursorrules 的潜在冲突 & 处理策略
- 当前基线遵循 .cursorrules; 如未来安全要求冲突, 先评估并提交变更计划, 在 docs/SECURITY_BASELINE.md 中更新结论

## 合并说明
- 初次创建该文件, 无需合并历史内容

## 与 .cursorrules 差异
- 无; 内容完全遵循 .cursorrules 规范
