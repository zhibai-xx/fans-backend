# Codex 工作规则与禁区

## 项目速览

- 框架: NestJS + TypeScript, 数据库 PostgreSQL + Prisma ORM
- 认证: JWT + Passport, 登录接口固定为 /api/users/login
- 上传: Multer 支持分片 multipart/form-data, 图片最大 50MB
- 文档: Swagger/OpenAPI 维护 API 契约, 文档和测试目录分别为 docs/ 与 tests/

## 必须遵守

- 坚持 TypeScript 全量类型, 遵循 NestJS 模块化结构和依赖注入
- 控制器仅处理 HTTP 交互, 服务层负责业务逻辑
- DTO 负责输入验证并使用 class-validator 与 class-transformer
- 代码注释使用中文, 标识符使用英文
- 所有 API 错误返回统一格式, message 字段始终为字符串, 多条错误使用分号连接
- 用户对象必须包含 id 与 uuid 字段, 与前端契约保持一致
- 绝不在项目根目录创建测试或文档文件, 测试放在 tests/ 目录, 文档放在 docs/ 目录
- Swagger 文档同步更新, 作为后端 API 契约单一事实来源
- 日志遵循项目自定义服务, 输出敏感信息前先脱敏
- 分片上传遵守 multipart/form-data, 限制图片最大 50MB, 严格校验文件类型与大小
- 所有输入要验证并在服务层执行权限或角色检查
- 修改数据库通过 Prisma 迁移, 命名清晰并评估性能影响

### 语言与注释规范

- 所有说明性内容（解释、注释、文档）必须使用中文。
- 代码、配置、命令行参数、变量名保持英文。
- 技术术语（NestJS、Prisma、JWT、OpenAPI 等）保留英文，不翻译。
- 若用户未指定语言，则默认使用中文进行回复与文档生成。

## 禁止事项

- 禁止在项目根添加新的 .md、测试脚本或临时文件
- 禁止返回不符合统一结构的错误响应或遗漏 message 字段
- 禁止创建 /api/auth/login 等错误路径, 登录仅限 /api/users/login
- 禁止跳过 DTO 验证或直接使用未校验的请求体
- 禁止上传超过 50MB 的图片或使用非 multipart/form-data 的上传接口
- 禁止在未评估影响的情况下修改 Swagger 契约或数据库 schema

## 工作模式

- 开发流程遵循: 契约设计 → Prisma schema → DTO 与验证 → 服务逻辑 → 控制器 → 错误与日志 → 文档与测试
- 发现问题时保持系统性分析, 建立问题清单并评估改动影响
- 与前端 fans-next 协作时优先核对接口路径、字段命名与数据格式

## 调试与测试

- 所有新测试文件创建后立即执行, 失败时持续调试直至通过
- 回归测试覆盖受影响模块, 避免产生新的回归问题
- 使用日志与网络面板追踪前后端数据流, 定位问题根因

## 与 .cursorrules 的潜在冲突 & 处理策略

- 当前草案未与 .cursorrules 发生冲突; 若未来需求出现偏差, 以 .cursorrules 为最高优先级并记录审批

## 合并说明

- 初次创建该文件, 无需合并历史内容

## 与 .cursorrules 差异

- 无; 内容完全遵循 .cursorrules 规范
