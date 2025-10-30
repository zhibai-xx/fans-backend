# NestJS + TypeScript 编码指南

## 架构约定
- 全面使用 TypeScript 并提供准确的类型定义
- 遵循 NestJS 模块化结构, 控制器负责 HTTP, 服务负责业务, 模块职责清晰
- 依赖注入通过构造函数完成, 避免静态调用

## 命名与注释
- 变量、函数、文件命名使用英文, 遵循 camelCase 或 PascalCase
- 业务逻辑或复杂流程添加简洁中文注释, 解释意图而非语法
- DTO 与实体字段名称保持与前端契约一致

## 目录与文件规范
- 根目录仅保留必需配置文件与 README.md
- 所有文档放在 docs/ 目录, 所有测试放在 tests/ 目录
- 模块目录结构示例: src/user/user.module.ts, user.controller.ts, user.service.ts, dto/
- 临时或示例代码放置在专属子目录, 不占用根目录

## 控制器与服务
- 控制器只处理路由、参数映射与响应, 不包含业务逻辑
- 服务层封装业务规则, 函数保持纯净, 便于测试
- 使用 Promise 与 async/await 处理异步流程, 避免回调嵌套

## DTO 与验证
- 每个输入对象定义 DTO, 使用 class-validator 提供的装饰器校验
- 应用 class-transformer 转换类型, 避免手动转换
- 验证错误使用统一异常过滤器转换为字符串, 以分号拼接

## 错误处理
- 全局异常过滤器输出统一结构: statusCode、timestamp、path、message、error
- message 字段必须为字符串, 不得返回数组或对象
- 业务错误定义明确的异常类型, 保持日志与错误码一致

## 日志与监控
- 使用自定义日志服务输出结构化日志
- 敏感信息脱敏后记录, 避免泄露 token、密码等
- 为关键路径添加调试日志, 便于排查分片上传、认证等问题

## Prisma 与数据库
- 通过 Prisma schema 定义数据模型, 迁移命名遵循 {日期}-{描述}
- 数据库操作考虑事务与并发, 使用 Prisma transaction API
- 用户实体始终包含 id 与 uuid, 与认证流程保持一致

## 测试策略
- 测试文件放置在 tests/ 目录, 区分单元与集成测试
- 创建测试后立即运行并记录结果, 失败需及时修复
- 回归测试覆盖上传、认证、数据库操作等关键场景

## Swagger 与契约
- 每个控制器与 DTO 使用 Swagger 装饰器描述接口
- 生成的 OpenAPI 文档是前后端契约单一事实来源
- 更新接口时同步更新 Swagger, 并与前端 fans-next 验证字段与路径

## 与 .cursorrules 的潜在冲突 & 处理策略
- 当前指南与 .cursorrules 一致; 如遇冲突, 优先遵循 .cursorrules 并在变更记录中说明处理方式

## 合并说明
- 初次创建该文件, 无需合并历史内容

## 与 .cursorrules 差异
- 无; 内容完全遵循 .cursorrules 规范
