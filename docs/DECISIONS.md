# 2025-11-10 系统导入来源统一策略
- 将 MediaSource 枚举精简为 USER_UPLOAD/SYSTEM_INGEST/ADMIN_UPLOAD/EXTERNAL_FEED，统一解释各种脚本、Playwright、API 归属系统导入
- 所有后端接口与日志去除微博字段，系统导入的 API 统一使用 `/upload/system-ingest/*`，source_metadata 以 ingestUserId/sourcePipeline 等泛化字段描述
- 前后端约定：系统导入上传服务仅接受对象化的 selectedFiles（包含 path/name/userId），避免出现敏感字样并便于后续扩展

