# 上传分片接口修复说明

## 问题描述

用户在上传文件时遇到两个主要问题：
1. **接口调用失败**：前端调用 `/upload/chunk` 接口时报错
2. **PayloadTooLargeError**：请求体过大错误，限制为102KB但实际需要220KB

## 问题分析

### 1. 字段名不匹配
- **前端发送**：`formData.append('file', file)`
- **后端期望**：`@UseInterceptors(FileInterceptor('chunk'))`
- **结果**：后端无法接收到文件数据

### 2. 文件大小限制
- **Express body-parser限制**：默认请求体限制约100KB
- **Multer限制**：需要单独配置文件上传大小
- **实际需求**：分片上传需要支持更大的文件（最大50MB）
- **结果**：`PayloadTooLargeError: request entity too large`

### 3. 请求解析冲突
- **JSON解析器**：尝试将multipart/form-data解析为JSON
- **Multer处理器**：专门处理multipart/form-data
- **结果**：`Unexpected token '-', "------WebK"... is not valid JSON`

### 4. 类型定义不一致
- **前端类型**：包含 `chunkMd5` 字段
- **后端实现**：不使用 `chunkMd5` 字段
- **结果**：类型不匹配，代码冗余

## 修复内容

### 1. 修复前端字段名

**文件**: `fans-next/src/services/upload.service.ts`

```typescript
// 修复前
formData.append('file', file);

// 修复后
formData.append('chunk', file); // 与后端 FileInterceptor('chunk') 匹配
```

### 2. 配置后端文件上传限制

**文件**: `fans-backend/src/main.ts`

```typescript
// 配置更大的请求体限制，同时正确处理multipart请求
const app = await NestFactory.create(AppModule);

const express = require('express');

// 只对非multipart请求应用JSON解析器
app.use((req, res, next) => {
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    // 对于multipart请求，跳过JSON解析器，让multer处理
    next();
  } else {
    // 对于其他请求，应用JSON解析器
    express.json({ limit: '50mb' })(req, res, next);
  }
});

// URL编码请求体解析器
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 配置文件上传超时
app.use('/api/upload', (req, res, next) => {
  req.setTimeout(300000); // 5分钟超时
  next();
});
```

**文件**: `fans-backend/src/upload/upload.module.ts`

```typescript
MulterModule.register({
  storage: diskStorage({
    destination: './uploads/temp',
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
      const ext = path.extname(file.originalname);
      cb(null, `${uniqueSuffix}${ext}`);
    },
  }),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB 文件大小限制
    files: 1, // 单次只允许上传一个文件
  },
}),
```

### 3. 统一类型定义

**文件**: `fans-next/src/types/upload.ts`

```typescript
// 移除不需要的字段
export interface UploadChunkRequest {
  uploadId: string;
  chunkIndex: number;
  totalChunks: number;
  // chunkMd5: string; // ❌ 删除：后端不使用
}
```

**文件**: `fans-next/src/lib/upload/file-uploader.ts`

```typescript
// 移除MD5计算逻辑
const chunkRequest: UploadChunkRequest = {
  uploadId: task.uploadId,
  chunkIndex,
  totalChunks,
  // chunkMd5, // ❌ 删除：不再需要
};
```

## 接口规范

### 上传分片接口

**URL**: `POST /api/upload/chunk`

**Headers**:
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Body** (FormData):
```
uploadId: string     // 上传ID
chunkIndex: number   // 分片索引
totalChunks: number  // 总分片数
chunk: File          // 分片文件数据
```

**Response**:
```json
{
  "success": true,
  "message": "分片 0 上传成功"
}
```

## 配置说明

### 文件大小限制
- **单个分片**：最大 50MB
- **请求超时**：5分钟
- **并发限制**：单次只允许上传一个文件

### 存储配置
- **临时目录**：`./uploads/temp`
- **文件命名**：`{timestamp}-{uuid}{ext}`
- **自动清理**：上传完成后自动移动到最终目录

## 测试验证

创建了测试脚本 `tests/test-upload-chunk-fix.js` 来验证修复效果：

```bash
# 启动后端服务
npm run start:dev

# 运行测试
node tests/test-upload-chunk-fix.js
```

## 预期结果

修复后，上传分片功能应该能够：
- ✅ 正确接收前端发送的分片数据
- ✅ 支持最大50MB的分片文件
- ✅ 返回正确的成功响应
- ✅ 不再出现 `PayloadTooLargeError` 错误

## 相关文件

### 后端修改
- ✅ `src/main.ts` - 添加上传接口配置
- ✅ `src/upload/upload.module.ts` - 配置Multer文件大小限制
- ✅ `src/upload/upload.controller.ts` - 上传分片接口实现（已存在）

### 前端修改
- ✅ `src/services/upload.service.ts` - 修复字段名
- ✅ `src/types/upload.ts` - 移除不需要的字段
- ✅ `src/lib/upload/file-uploader.ts` - 移除MD5计算

### 测试文件
- ✅ `tests/test-upload-chunk-fix.js` - 分片上传测试脚本
- ✅ `tests/test-upload-size-fix.js` - 文件大小限制测试脚本
- ✅ `tests/test-multipart-fix.js` - multipart请求处理测试脚本

## 注意事项

1. **重启服务**：修改main.ts后需要重启后端服务才能生效
2. **分片大小建议**：建议使用5MB分片大小，平衡上传效率和内存使用
3. **网络超时**：大文件上传时注意网络超时设置
4. **错误处理**：前端需要处理网络中断和重试逻辑
5. **安全考虑**：文件类型验证和病毒扫描（后续可添加）

## 故障排除

如果仍然遇到 `PayloadTooLargeError` 错误：

1. **确认服务重启**：修改main.ts后必须重启后端服务
2. **检查配置**：确认body parser配置正确应用
3. **运行测试**：使用测试脚本验证配置是否生效

```bash
# 重启后端服务
npm run start:dev

# 运行测试验证
node tests/test-upload-size-fix.js
node tests/test-multipart-fix.js
``` 