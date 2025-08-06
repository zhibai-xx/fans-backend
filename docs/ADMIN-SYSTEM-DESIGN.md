# 后台管理系统设计文档

## 概述

本文档描述了粉丝社区项目后台管理系统的完整设计，包括架构设计、权限控制、操作记录系统等核心功能的实现方案。

## 系统架构设计

### 前端路由结构
```
/admin/
├── dashboard/           # 管理面板首页 - 系统概览、关键指标
├── users/              # 用户管理 - 用户列表、权限管理、状态控制
├── media/              # 媒体内容管理 - 批量操作、状态变更
├── tags/               # 标签管理 - 增删改查、使用统计
├── categories/         # 分类管理 - 增删改查、使用统计
├── review/             # 审核管理 - 现有审核功能迁移
├── logs/               # 操作记录 - 用户操作、系统操作、审核记录
└── settings/           # 系统设置 - 系统配置、性能监控
```

### 权限控制升级

#### 1. 前端路由保护
- 更新 `middleware.ts` 添加 `/admin/*` 路径到管理员专用路径
- 确保所有后台管理页面都经过权限验证

#### 2. 后端API保护
- 所有管理API接口使用 `@UseGuards(JwtAuthGuard, AdminRoleGuard)`
- 增加更细粒度的权限控制（如只读管理员、超级管理员等）

#### 3. UI权限控制
- 扩展 `PermissionGuard` 组件支持更多权限类型
- 菜单项根据权限动态显示/隐藏

## 操作记录系统设计

### 新增数据库表

#### OperationLog 操作记录表
```prisma
model OperationLog {
  id            String   @id @default(uuid())
  operation_type OperationType           // 操作类型
  module        String   @db.VarChar(50) // 操作模块（users, media, tags等）
  action        String   @db.VarChar(50) // 具体操作（create, update, delete等）
  target_type   String   @db.VarChar(50) // 目标对象类型
  target_id     String?                  // 目标对象ID
  target_name   String?  @db.VarChar(200) // 目标对象名称（便于显示）
  old_values    Json?                    // 操作前的值
  new_values    Json?                    // 操作后的值
  ip_address    String?  @db.VarChar(45) // 操作者IP地址
  user_agent    String?  @db.VarChar(500) // 浏览器标识
  description   String?  @db.VarChar(500) // 操作描述
  result        OperationResult @default(SUCCESS) // 操作结果
  error_message String?                  // 错误信息（失败时）
  created_at    DateTime @default(now())

  // 关联关系
  user_id       Int      @map("user_id")
  user          User     @relation(fields: [user_id], references: [id])

  @@index([user_id, created_at])
  @@index([module, action])
  @@index([operation_type, created_at])
  @@index([target_type, target_id])
}

enum OperationType {
  USER_ACTION      // 用户操作（登录、上传、举报等）
  MEDIA_ACTION     // 媒体操作（上传、删除、编辑、状态变更等）
  ADMIN_ACTION     // 管理员操作（审核、用户管理等）
  SYSTEM_ACTION    // 系统操作（自动处理、定时任务等）
}

enum OperationResult {
  SUCCESS
  FAILED
  PARTIAL  // 部分成功（批量操作时）
}
```

#### LoginLog 登录记录表（独立管理登录行为）
```prisma
model LoginLog {
  id         String   @id @default(uuid())
  login_type LoginType @default(PASSWORD) // 登录方式
  ip_address String   @db.VarChar(45)     // 登录IP
  user_agent String   @db.VarChar(500)    // 浏览器标识
  location   String?  @db.VarChar(100)    // 登录地点（可选）
  result     LoginResult @default(SUCCESS) // 登录结果
  fail_reason String? @db.VarChar(200)    // 失败原因
  created_at DateTime @default(now())

  // 关联关系
  user_id    Int?     @map("user_id")    // 可为空，支持失败登录记录
  user       User?    @relation(fields: [user_id], references: [id])

  @@index([user_id, created_at])
  @@index([ip_address, created_at])
  @@index([result, created_at])
}

enum LoginType {
  PASSWORD      // 密码登录
  OAUTH         // 第三方登录
  REMEMBER_ME   // 记住我登录
}

enum LoginResult {
  SUCCESS
  FAILED
  BLOCKED       // 被阻止（频繁失败等）
}
```

### 操作记录实现机制

#### 1. 后端拦截器设计
```typescript
@Injectable()
export class OperationLogInterceptor implements NestInterceptor {
  // 自动记录API操作
  // 支持配置哪些操作需要记录
  // 提取请求参数、响应结果等信息
}
```

#### 2. 服务层装饰器
```typescript
@LogOperation({
  module: 'users',
  action: 'update',
  description: '更新用户信息'
})
async updateUser(id: number, updateData: UpdateUserDto) {
  // 业务逻辑
}
```

#### 3. 前端埋点
```typescript
// 自动记录关键用户操作
const logUserAction = (action: string, target?: any) => {
  // 发送操作记录到后端
};
```

## 各功能模块设计

### 1. 用户管理模块
- **用户列表**：分页显示、搜索筛选、批量操作
- **用户详情**：编辑基本信息、权限管理、操作历史
- **状态管理**：启用/禁用用户、重置密码
- **权限控制**：角色分配、权限配置

### 2. 标签和分类管理
- **增删改查**：基本CRUD操作
- **批量操作**：批量删除、批量修改
- **使用统计**：关联内容数量、使用频率分析
- **合并功能**：重复标签合并

### 3. 媒体内容管理
- **批量审核**：状态批量变更、批量删除
- **内容编辑**：标题、描述、标签、分类编辑
- **质量管理**：重复内容检测、质量评估
- **统计分析**：上传趋势、审核效率分析

### 4. 操作记录页面
- **多维度筛选**：按用户、时间、操作类型、模块筛选
- **详细查看**：操作前后对比、完整操作链路
- **导出功能**：支持CSV/Excel导出
- **实时监控**：关键操作实时提醒

## 安全设计

### 1. 多层权限验证
- 前端路由中间件验证
- 后端API守卫验证
- 数据库级别的权限检查

### 2. 操作审计
- 所有管理操作全程记录
- 敏感操作二次确认
- 操作日志不可删除、不可修改

### 3. 访问控制
- IP白名单（可选）
- 会话超时控制
- 并发登录限制

## 实施计划

### 第一阶段：基础架构（1-2天）
1. 更新数据库表结构
2. 创建后台管理布局组件
3. 更新路由保护机制

### 第二阶段：核心功能（3-4天）
1. 实现用户管理功能
2. 实现标签和分类管理
3. 迁移现有审核功能

### 第三阶段：高级功能（2-3天）
1. 实现操作记录系统
2. 媒体内容管理功能
3. 系统统计和分析

### 第四阶段：测试和优化（1-2天）
1. 全面的权限安全测试
2. 性能优化
3. 用户体验优化

## 注意事项

1. **渐进式迁移**：现有审核功能先迁移，再逐步增加新功能
2. **安全第一**：每个功能都需要经过严格的权限测试
3. **操作可追踪**：重要操作都需要有完整的审计日志
4. **用户体验**：管理界面要简洁高效，支持批量操作
5. **性能考虑**：操作记录表数据量大，需要合理的索引和分页策略