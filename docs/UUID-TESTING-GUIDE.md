# UUID安全系统测试指南

## 🚀 快速开始

### 1. 启动后端服务

```bash
cd fans-backend
npm run start:dev
```

服务启动后会显示：

```
[Nest] Application successfully started on port 3000
```

### 2. 验证服务状态

```bash
# 测试基本连接
node test-connection.js
```

### 3. 运行UUID系统测试

```bash
# 完整的UUID安全测试
node test-uuid-system.js
```

## 📋 测试内容

### 🔗 连接测试 (test-connection.js)

- ✅ 后端服务连接状态
- ✅ API路由可访问性
- ✅ Swagger文档状态

### 🛡️ UUID安全测试 (test-uuid-system.js)

- ✅ 用户注册返回UUID
- ✅ 通过UUID查询用户信息
- ✅ 媒体列表UUID过滤
- ✅ 数字ID访问被拒绝
- ✅ JWT包含双ID信息

## 🌐 API端点

### 用户相关

```
POST /api/users/register     # 用户注册
POST /api/users/login        # 用户登录
GET  /api/users/profile      # 获取当前用户信息
GET  /api/users/{uuid}       # 通过UUID获取用户信息
PUT  /api/users/profile      # 更新用户信息
```

### 媒体相关

```
GET  /api/media              # 获取媒体列表
GET  /api/media?userUuid={uuid}  # 按用户UUID过滤
GET  /api/media/{id}         # 获取媒体详情
```

## 🧪 测试场景

### 1. 安全性测试

```bash
# ✅ 正确：使用UUID
curl -H "Authorization: Bearer {token}" \
  http://localhost:3000/api/users/550e8400-e29b-41d4-a716-446655440000

# ❌ 错误：使用数字ID（应该被拒绝）
curl -H "Authorization: Bearer {token}" \
  http://localhost:3000/api/users/123
```

### 2. 性能测试

```bash
# 批量UUID转换测试
curl http://localhost:3000/api/media?take=50
```

### 3. JWT验证测试

```bash
# 解码JWT查看payload
echo "{jwt_token}" | cut -d. -f2 | base64 -d | jq
```

## 📊 预期结果

### 用户注册响应

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "username": "testuser",
    "email": "test@example.com",
    "nickname": "Test User",
    "role": "USER",
    "status": "ACTIVE",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### JWT Payload

```json
{
  "username": "testuser",
  "sub": 123,                                    // 内部ID（性能）
  "uuid": "550e8400-e29b-41d4-a716-446655440000", // UUID（安全）
  "iat": 1640995200,
  "exp": 1643587200
}
```

### 媒体列表响应

```json
{
  "data": [
    {
      "id": "media-uuid-123",
      "title": "示例媒体",
      "user": {
        "uuid": "550e8400-e29b-41d4-a716-446655440000", // 用户UUID
        "username": "testuser"
      }
    }
  ],
  "meta": {
    "total": 1,
    "skip": 0,
    "take": 10,
    "hasMore": false
  }
}
```

## 🔍 故障排除

### 问题1: 连接被拒绝

```
Error: connect ECONNREFUSED 127.0.0.1:3000
```

**解决方案**: 确保后端服务正在运行

```bash
npm run start:dev
```

### 问题2: 404 Not Found

```
Cannot POST /users/register
```

**解决方案**: 检查API前缀，应该使用 `/api/users/register`

### 问题3: 401 Unauthorized

```
Unauthorized
```

**解决方案**: 确保请求头包含有效的JWT token

```bash
curl -H "Authorization: Bearer {your_token}" ...
```

### 问题4: UUID格式错误

```
User not found
```

**解决方案**: 确保使用正确的UUID格式

```
✅ 正确: 550e8400-e29b-41d4-a716-446655440000
❌ 错误: 123
```

## 📈 性能监控

### 查询性能对比

```sql
-- UUID查询（外部API）
SELECT * FROM "User" WHERE uuid = '550e8400-e29b-41d4-a716-446655440000';

-- 内部ID查询（内部使用）
SELECT * FROM "User" WHERE id = 123;
```

### 批量操作优化

```typescript
// 避免N+1查询
const userIds = [1, 2, 3, 4, 5];
const uuidMapping = await userUuidService.getUuidMappingByIds(userIds);
```

## 🛡️ 安全检查清单

- [ ] 所有外部API只使用UUID
- [ ] 响应数据不包含内部ID
- [ ] JWT包含UUID验证
- [ ] 数字ID访问被拒绝
- [ ] 错误信息不泄露内部ID
- [ ] 日志记录使用UUID

## 📚 相关文档

- [UUID安全系统实现文档](./UUID-SECURITY-IMPLEMENTATION.md)
- [实现总结](./UUID-IMPLEMENTATION-SUMMARY.md)
- [Swagger API文档](http://localhost:3000/api)

## 🎯 下一步

1. **启动服务**: `npm run start:dev`
2. **运行测试**: `node test-uuid-system.js`
3. **查看文档**: 访问 http://localhost:3000/api
4. **前端适配**: 更新前端代码使用UUID接口

完成测试后，你的UUID安全系统就可以投入使用了！
