# 贡献指南

## 分支策略
- main 为稳定生产分支, develop 为集成分支
- 功能分支命名 feature/<scope>-<short-desc>, 修复分支命名 fix/<scope>-<short-desc>
- 数据库迁移或安全更新使用 chore/db-<desc>, chore/sec-<desc>

## 提交信息规范
- 遵循 Conventional Commits: <type>(<scope>): <subject>
- 常用 type 包含 feat、fix、docs、refactor、test、chore
- subject 使用英文动词开头, 说明具体改动

## Pull Request 模板要素
- 变更摘要
- 测试情况 (含执行的命令)
- 契约或 Swagger 是否更新
- 安全与性能影响说明
- 回滚步骤或验证方案

## 评审流程
- 在提交 PR 前自检编码规范、统一错误格式与日志
- 至少一名后端成员进行代码审查, 关注 DTO 验证、错误处理、目录规范
- 需要前端协调时 @fans-next 负责人确认契约同步
- 所有意见需在 PR 解决或解释后方可合并

## 回滚策略
- 发现严重问题立即回退分支或恢复到上一个稳定 tag
- 涉及数据库迁移时准备逆向迁移脚本, 并在 docs 记录
- 回滚后更新问题清单, 追踪根因并安排修复

## 目录与文档约束
- 文档仅存放于 docs/ 目录, README.md 为根目录唯一 md 文件
- 测试文件全部放在 tests/ 目录, 新增后立即执行验证
- 上传、认证相关变更需同步更新 Swagger 契约与安全基线

## 与 .cursorrules 的潜在冲突 & 处理策略
- 当前指南与 .cursorrules 保持一致; 如流程要求特例, 需创建 issue 说明原因并获批后执行

## 合并说明
- 初次创建该文件, 无需合并历史内容

## 与 .cursorrules 差异
- 无; 内容完全遵循 .cursorrules 规范
