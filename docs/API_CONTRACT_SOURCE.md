# API 契约单一事实来源流程

## 核心原则
- Swagger/OpenAPI 文档是后端 API 契约的唯一事实来源
- 所有接口变更必须先更新契约, 再同步代码与前端
- 契约字段与用户对象字段保持一致, 包含 id 与 uuid

## 流程步骤
- 需求评审时定义接口路径、方法、请求与响应模型
- 更新 NestJS 控制器与 DTO 的 Swagger 装饰器, 生成最新 OpenAPI
- 运行 NestJS 应用后导出 swagger.json, 作为同步依据
- 使用 swagger-codegen 或 openapi-generator 产出前端 SDK, 存入 fans-next 仓库
- 在 fans-next 中对比接口差异, 校验请求路径与字段命名
- 后端在合并前执行契约快照比对, 确认 swagger.json 无意外改动

## 守护措施
- 在 tests/ 中保留契约快照测试, 确保 message 字段类型保持字符串
- 对 multipart/form-data 与分片上传接口标注 file schema 与 50MB 限制
- 登录接口固定为 /api/users/login, 契约描述中强调认证流程

## 交付物
- docs/ 中保存版本化的契约说明或变更日志
- 发布新版本时生成带版本号的 swagger.json 并通知 fans-next 团队
- 记录契约与数据库 schema 的映射关系, 避免字段遗漏

## 与 .cursorrules 的潜在冲突 & 处理策略
- 未发现冲突; 若前端或第三方流程要求偏离, 需在契约变更记录中注明并征得 .cursorrules 级别确认

## 合并说明
- 初次创建该文件, 无需合并历史内容

## 与 .cursorrules 差异
- 无; 内容完全遵循 .cursorrules 规范
