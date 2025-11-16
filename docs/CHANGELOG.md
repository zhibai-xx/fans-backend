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
