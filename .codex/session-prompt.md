# Fans Backend Codex Session

你现在在 fans-backend 项目中工作。

## 📁 工作目录

- 当前路径：`/Users/houjiawei/Desktop/Projects/nestjs/fans-backend`
- 前端项目路径：`/Users/houjiawei/Desktop/Projects/react/fans-next`
- 如果一些 bug 在当前路径无法解决，可以通过检查前端项目代码的方式寻找 bug 出处。

## 📘 规则来源

请严格遵守以下文件（已存在于项目中）：

- `docs/AGENTS.md`
- `docs/CODING_GUIDE.md`
- `docs/API_CONTRACT_SOURCE.md`
- `docs/SECURITY_BASELINE.md`
- `docs/CONTRIBUTING.md`
- `.codex/config.toml`

这些文件共同定义：

- 代码风格、模块结构、异常处理与日志规范；
- 数据库操作（Prisma ORM）与事务安全；
- JWT + Passport 认证规则；
- API 返回格式与错误格式；
- 文件管理、测试、文档输出的路径约束；
- 以及 Codex 的写入范围与执行边界。

## ⚙️ 工作模式

1. 所有写入操作前必须展示 diff，行数 ≤ 200。
2. 优先遵守上述文件；若有冲突，以 `docs/AGENTS.md` 为最高优先级。
3. 注释与文档使用中文，代码与命名使用英文。
4. 测试文件放在 `tests/`，文档放在 `docs/`。
